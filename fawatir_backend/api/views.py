from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.core.mail import send_mail, EmailMessage
from django.core.mail.backends.smtp import EmailBackend
from django.conf import settings
from twilio.rest import Client as TwilioClient
import os
from . import models, serializers

TENANT_RELATION_MAP = {
    # Accounting
    'InvoiceItem': 'invoice__organisation_id',
    'BankTransaction': 'bank_account__organisation_id',
    'BankReconciliation': 'transaction__bank_account__organisation_id',

    # Quotations & Purchase Orders
    'QuotationItem': 'quotation__organisation_id',
    'PurchaseOrderItem': 'purchase_order__organisation_id',

    # Point of Sale
    'PosSaleItem': 'sale__organisation_id',

    # Human Resources & Payroll
    'PayrollItem': 'payroll__organisation_id',

    # CRM
    'ClientContact': 'client__organisation_id',
    'CustomerAddress': 'client__organisation_id',
    'CustomerPortal': 'client__organisation_id',
    'SupplierContact': 'supplier__organisation_id',
    'SupplierAddress': 'supplier__organisation_id',
    'MarketingAd': 'campaign__organisation_id',
    'MarketingMetric': 'ad__campaign__organisation_id',

    # Inventory
    'ProductVariant': 'product__organisation_id',
    'Inventory': 'product__organisation_id',
    'StockMovement': 'product__organisation_id',
    'SupplierProduct': 'product__organisation_id',

    # IAM & User
    'UserPreference': 'user__organisation_id',
    'UserSession': 'user__organisation_id',
    'RolePermission': 'role__organisation_id',
    'PasswordReset': 'user__organisation_id',
    'EmailVerification': 'user__organisation_id',

    # AI
    'AiMessage': 'conversation__organisation_id',
}


def get_object_org_id(obj):
    """
    Returns the organisation_id (as str) for any model instance or related object.
    Supports direct organisation/organization attributes and relational traversal.
    """
    if obj is None:
        return None
    if hasattr(obj, 'organisation_id') and obj.organisation_id:
        return str(obj.organisation_id)
    if hasattr(obj, 'organisation') and obj.organisation:
        return str(getattr(obj.organisation, 'id', obj.organisation))
    if hasattr(obj, 'organization_id') and obj.organization_id:
        return str(obj.organization_id)
    if hasattr(obj, 'organization') and obj.organization:
        return str(getattr(obj.organization, 'id', obj.organization))

    if obj.__class__.__name__ == 'Organization' and hasattr(obj, 'id'):
        return str(obj.id)

    model_name = obj.__class__.__name__
    if model_name in TENANT_RELATION_MAP:
        lookup_path = TENANT_RELATION_MAP[model_name]
        parts = lookup_path.split('__')
        curr = obj
        for part in parts:
            if curr is None:
                break
            curr = getattr(curr, part, None)
        if curr:
            return str(curr)

    return None


class TenantIsolationMixin:
    """
    Ensures multi-tenant data isolation across all top-level and child models.
    Resolves the organization ID from:
    1. Authenticated user's organisation_id attribute or api.models.User lookup
    2. Incoming x-organization-id / X-Organization-Id HTTP header
    """
    def get_tenant_organisation_id(self):
        req = getattr(self, 'request', None)
        header_org = None
        if req and hasattr(req, 'headers'):
            header_org = req.headers.get('x-organization-id') or req.headers.get('X-Organization-Id')
        elif req and hasattr(req, 'META'):
            header_org = req.META.get('HTTP_X_ORGANIZATION_ID')

        user = getattr(req, 'user', None)
        if user and user.is_authenticated:
            # 1. Direct attribute check
            direct_org = getattr(user, 'organisation_id', None) or getattr(user, 'organization_id', None)
            if direct_org:
                return str(direct_org)

            # 2. Email lookup in api.models.User
            user_email = getattr(user, 'email', None)
            if user_email:
                tenant_user = models.User.objects.filter(email=user_email).first()
                if tenant_user and tenant_user.organisation_id:
                    return str(tenant_user.organisation_id)
                    
                # RECOVERY: Auto-recreate missing tenant user
                first_org = models.Organization.objects.first()
                if first_org:
                    role = models.Role.objects.filter(organisation=first_org, display_name__icontains="Admin").first()
                    if not role:
                        role = models.Role.objects.create(organisation=first_org, display_name="Administrateur", system_name="administrateur")
                    models.User.objects.create(
                        organisation=first_org,
                        role=role,
                        email=user_email,
                        first_name=getattr(user, 'first_name', None) or "Master",
                        last_name=getattr(user, 'last_name', None) or "Admin",
                        is_active=True,
                        email_verified=True
                    )
                    return str(first_org.id)

        if header_org:
            return str(header_org)

        return None

    def get_queryset(self):
        qs = super().get_queryset()
        org_id = self.get_tenant_organisation_id()
        if org_id is None:
            return qs.none()

        model_cls = getattr(getattr(self, 'serializer_class', None), 'Meta', None)
        model = getattr(model_cls, 'model', None)
        if not model:
            model = getattr(qs, 'model', None)

        if not model:
            return qs.none()

        model_name = model.__name__

        # Organization model itself
        if model_name == 'Organization':
            return qs.filter(id=org_id)

        # Direct organisation relationship
        if hasattr(model, 'organisation'):
            return qs.filter(organisation_id=org_id)

        # Direct organization (with 'z', e.g. Document, SpreadsheetImport)
        if hasattr(model, 'organization'):
            return qs.filter(organization_id=org_id)

        # Direct bank_account fallback
        if hasattr(model, 'bank_account'):
            return qs.filter(bank_account__organisation_id=org_id)

        # Traversal lookup via TENANT_RELATION_MAP across all 23 child entities
        if model_name in TENANT_RELATION_MAP:
            lookup = TENANT_RELATION_MAP[model_name]
            return qs.filter(**{lookup: org_id})

        return qs.none()

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        from django.db.models import Model

        org_id = self.get_tenant_organisation_id()
        model_cls = getattr(getattr(serializer, 'Meta', None), 'model', None)

        # Validate that any parent foreign key provided in validated_data belongs to requesting tenant's organization
        if org_id is not None:
            for field_name, field_val in list(serializer.validated_data.items()):
                if field_name in ['organisation', 'organisation_id', 'organization', 'organization_id']:
                    continue

                related_obj = None
                if isinstance(field_val, Model):
                    related_obj = field_val
                elif model_cls:
                    try:
                        model_field = model_cls._meta.get_field(field_name)
                        if model_field.is_relation and model_field.related_model and field_val is not None:
                            related_obj = model_field.related_model.objects.filter(pk=field_val).first()
                    except Exception:
                        pass

                if related_obj:
                    target_org_id = get_object_org_id(related_obj)
                    if target_org_id and str(target_org_id) != str(org_id):
                        raise ValidationError({
                            field_name: [f"Cross-tenant reference prohibited: {field_name} belongs to a different organization."]
                        })

        if org_id is not None and model_cls and hasattr(model_cls, 'organisation'):
            # Neutralize any attacker-injected organisation parameter to prevent IDOR
            serializer.validated_data.pop('organisation', None)
            serializer.validated_data.pop('organisation_id', None)
            serializer.save(organisation_id=org_id)
        elif org_id is not None and model_cls and hasattr(model_cls, 'organization'):
            serializer.validated_data.pop('organization', None)
            serializer.validated_data.pop('organization_id', None)
            serializer.save(organization_id=org_id)
        else:
            default_org = models.Organization.objects.first()
            if default_org and model_cls and hasattr(model_cls, 'organisation') and 'organisation' not in serializer.validated_data:
                serializer.save(organisation=default_org)
            elif default_org and model_cls and hasattr(model_cls, 'organization') and 'organization' not in serializer.validated_data:
                serializer.save(organization=default_org)
            else:
                serializer.save()

    def perform_update(self, serializer):
        from rest_framework.exceptions import ValidationError
        from django.db.models import Model

        org_id = self.get_tenant_organisation_id()
        model_cls = getattr(getattr(serializer, 'Meta', None), 'model', None)

        if org_id is not None:
            serializer.validated_data.pop('organisation', None)
            serializer.validated_data.pop('organisation_id', None)
            serializer.validated_data.pop('organization', None)
            serializer.validated_data.pop('organization_id', None)

            for field_name, field_val in list(serializer.validated_data.items()):
                related_obj = None
                if isinstance(field_val, Model):
                    related_obj = field_val
                elif model_cls:
                    try:
                        model_field = model_cls._meta.get_field(field_name)
                        if model_field.is_relation and model_field.related_model and field_val is not None:
                            related_obj = model_field.related_model.objects.filter(pk=field_val).first()
                    except Exception:
                        pass

                if related_obj:
                    target_org_id = get_object_org_id(related_obj)
                    if target_org_id and str(target_org_id) != str(org_id):
                        raise ValidationError({
                            field_name: [f"Cross-tenant reference prohibited: {field_name} belongs to a different organization."]
                        })

        serializer.save()


class IsAdminRoleOnly(permissions.BasePermission):
    """
    Custom permission to ensure only users with 'Admin' or 'Administrateur' role can modify roles/IAM.
    Returns 403 Forbidden if unauthorized.
    """
    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
            return True
        user_role = getattr(getattr(user, 'role', None), 'system_name', None) or getattr(user, 'role_name', '')
        if not user_role and hasattr(user, 'email'):
            tenant_user = models.User.objects.filter(email=user.email).first()
            if tenant_user and tenant_user.role:
                user_role = getattr(tenant_user.role, 'display_name', '') or getattr(tenant_user.role, 'system_name', '')
        if user_role and str(user_role).lower() in ['admin', 'administrateur']:
            return True
        raise PermissionDenied(detail="Unauthorized: Only Admin users can modify roles (HTTP 403).")


# ==========================================
# FOUNDATION & IAM
# ==========================================

class OrganizationViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset = models.Organization.objects.all()
    serializer_class = serializers.OrganizationSerializer
class RoleViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.Role.objects.all(), serializers.RoleSerializer
    permission_classes = [IsAdminRoleOnly]

class UserViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.User.objects.all(), serializers.UserSerializer
    permission_classes = [IsAdminRoleOnly]


class PermissionViewSet(viewsets.ModelViewSet):
    queryset, serializer_class = models.Permission.objects.all(), serializers.PermissionSerializer
    permission_classes = [IsAdminRoleOnly]


class RolePermissionViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.RolePermission.objects.all(), serializers.RolePermissionSerializer
    permission_classes = [IsAdminRoleOnly]


class OrganizationSettingViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.OrganizationSetting.objects.all(), serializers.OrganizationSettingSerializer

class AuditLogViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.AuditLog.objects.all(), serializers.AuditLogSerializer

class UserPreferenceViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.UserPreference.objects.all(), serializers.UserPreferenceSerializer


class UserSessionViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.UserSession.objects.all(), serializers.UserSessionSerializer


class PasswordResetViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.PasswordReset.objects.all(), serializers.PasswordResetSerializer


class EmailVerificationViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.EmailVerification.objects.all(), serializers.EmailVerificationSerializer

class ActivityLogViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.ActivityLog.objects.all(), serializers.ActivityLogSerializer


class NotificationViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.Notification.objects.all(), serializers.NotificationSerializer


class PdfTemplateViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.PdfTemplate.objects.all(), serializers.PdfTemplateSerializer


# ==========================================
# CRM MODULE
# ==========================================

class ClientViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.Client.objects.all(), serializers.ClientSerializer

class SupplierViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.Supplier.objects.all(), serializers.SupplierSerializer

    @action(detail=False, methods=['post'])
    def clear(self, request):
        self.get_queryset().delete()
        return Response({"status": "cleared"})

class MarketingCampaignViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.MarketingCampaign.objects.all(), serializers.MarketingCampaignSerializer


class ClientContactViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.ClientContact.objects.all(), serializers.ClientContactSerializer


class CustomerAddressViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.CustomerAddress.objects.all(), serializers.CustomerAddressSerializer


class CustomerPortalViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.CustomerPortal.objects.all(), serializers.CustomerPortalSerializer


class SupplierContactViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.SupplierContact.objects.all(), serializers.SupplierContactSerializer


class SupplierAddressViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.SupplierAddress.objects.all(), serializers.SupplierAddressSerializer


class WhatsappMessageViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.WhatsappMessage.objects.all(), serializers.WhatsappMessageSerializer


class MarketingAdViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.MarketingAd.objects.all(), serializers.MarketingAdSerializer


class MarketingMetricViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.MarketingMetric.objects.all(), serializers.MarketingMetricSerializer


# ==========================================
# INVENTORY MODULE
# ==========================================

class CategoryViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.Category.objects.all(), serializers.CategorySerializer

class ProductViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.Product.objects.all(), serializers.ProductSerializer

    @action(detail=False, methods=['post'])
    def clear(self, request):
        self.get_queryset().delete()
        return Response({"status": "cleared"})

class ProductVariantViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.ProductVariant.objects.all(), serializers.ProductVariantSerializer


class InventoryViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.Inventory.objects.all(), serializers.InventorySerializer


class StockMovementViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.StockMovement.objects.all(), serializers.StockMovementSerializer


class SupplierProductViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.SupplierProduct.objects.all(), serializers.SupplierProductSerializer


# ==========================================
# ACCOUNTING MODULE
# ==========================================

class InvoiceViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.Invoice.objects.all(), serializers.InvoiceSerializer
    
    @action(detail=False, methods=['post'])
    def clear(self, request):
        self.get_queryset().delete()
        return Response({"status": "cleared"})

    @action(detail=True, methods=['post'])
    def send_email(self, request, pk=None):
        invoice = self.get_object()
        client_email = invoice.client.email if invoice.client else request.data.get('email')

        if not client_email:
            return Response({"error": "No email address provided or found for this client."}, status=400)

        org_name = invoice.organisation.name if invoice.organisation else 'Tadbir AI'
        subject = f"Invoice {invoice.invoice_number} from {org_name}"
        message = f"Hello,\n\nPlease find attached the details for Invoice {invoice.invoice_number}.\nTotal Amount: {invoice.total_amount}\n\nThank you!"

        settings_obj = invoice.organisation.settings.first() if invoice.organisation and hasattr(invoice.organisation, 'settings') else None

        try:
            if settings_obj and getattr(settings_obj, 'smtp_host', None) and getattr(settings_obj, 'smtp_user', None) and getattr(settings_obj, 'smtp_password', None):
                smtp_port = getattr(settings_obj, 'smtp_port', 587)
                use_ssl = int(smtp_port) == 465
                use_tls = int(smtp_port) == 587
                backend = EmailBackend(
                    host=settings_obj.smtp_host,
                    port=smtp_port,
                    username=settings_obj.smtp_user,
                    password=settings_obj.smtp_password,
                    use_tls=use_tls,
                    use_ssl=use_ssl
                )
                email = EmailMessage(
                    subject=subject,
                    body=message,
                    from_email=settings_obj.smtp_user,
                    to=[client_email],
                    connection=backend
                )
                email.send()
            else:
                send_mail(
                    subject,
                    message,
                    settings.EMAIL_HOST_USER or 'noreply@tadbir.ai',
                    [client_email],
                    fail_silently=False,
                )
            return Response({"status": "Email sent successfully!"})
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=True, methods=['post'])
    def send_whatsapp(self, request, pk=None):
        invoice = self.get_object()
        client_phone = invoice.client.phone if invoice.client else request.data.get('phone')

        if not client_phone:
            return Response({"error": "No phone number provided or found for this client."}, status=400)

        settings_obj = invoice.organisation.settings.first() if invoice.organisation and hasattr(invoice.organisation, 'settings') else None
        account_sid = (getattr(settings_obj, 'twilio_account_sid', None) if settings_obj else None) or os.environ.get('TWILIO_ACCOUNT_SID')
        auth_token = (getattr(settings_obj, 'twilio_auth_token', None) if settings_obj else None) or os.environ.get('TWILIO_AUTH_TOKEN')
        twilio_number = (getattr(settings_obj, 'twilio_phone_number', None) if settings_obj else None) or os.environ.get('TWILIO_WHATSAPP_NUMBER')

        if not all([account_sid, auth_token, twilio_number]):
            return Response({"error": "Twilio credentials are not configured on the server or in organization settings."}, status=500)

        try:
            client = TwilioClient(account_sid, auth_token)
            whatsapp_message = client.messages.create(
                body=f"Hello, your invoice {invoice.invoice_number} for {invoice.total_amount} MAD is ready.",
                from_=twilio_number,
                to=f"whatsapp:{client_phone}" if not client_phone.startswith('whatsapp:') else client_phone
            )
            return Response({"status": "WhatsApp message sent successfully!", "sid": whatsapp_message.sid})
        except Exception as e:
            return Response({"error": str(e)}, status=500)


class InvoiceItemViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.InvoiceItem.objects.all(), serializers.InvoiceItemSerializer


class PaymentViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.Payment.objects.all(), serializers.PaymentSerializer


class BankAccountViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.BankAccount.objects.all(), serializers.BankAccountSerializer


class RecurringInvoiceViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.RecurringInvoice.objects.all(), serializers.RecurringInvoiceSerializer


class BankTransactionViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.BankTransaction.objects.all(), serializers.BankTransactionSerializer


class BankReconciliationViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.BankReconciliation.objects.all(), serializers.BankReconciliationSerializer


# ==========================================
# QUOTATIONS MODULE
# ==========================================
class QuotationViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.Quotation.objects.all(), serializers.QuotationSerializer

    @action(detail=False, methods=['post'])
    def clear(self, request):
        self.get_queryset().delete()
        return Response({"status": "cleared"})

class QuotationItemViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.QuotationItem.objects.all(), serializers.QuotationItemSerializer


# ==========================================
# PURCHASE ORDERS MODULE
# ==========================================

class PurchaseOrderViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.PurchaseOrder.objects.all(), serializers.PurchaseOrderSerializer


class PurchaseOrderItemViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.PurchaseOrderItem.objects.all(), serializers.PurchaseOrderItemSerializer


# ==========================================
# POS MODULE
# ==========================================

class PosSessionViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.PosSession.objects.all(), serializers.PosSessionSerializer


class PosSaleViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.PosSale.objects.all(), serializers.PosSaleSerializer


class PosSaleItemViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.PosSaleItem.objects.all(), serializers.PosSaleItemSerializer


# ==========================================
# HUMAN RESOURCES MODULE
# ==========================================

class DepartmentViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.Department.objects.all(), serializers.DepartmentSerializer


class EmployeeViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.Employee.objects.all(), serializers.EmployeeSerializer


class PayrollViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.Payroll.objects.all(), serializers.PayrollSerializer


class PayrollItemViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.PayrollItem.objects.all(), serializers.PayrollItemSerializer


# ==========================================
# AI MODULE
# ==========================================

class AiConversationViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.AiConversation.objects.all(), serializers.AiConversationSerializer


class OcrDocumentViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.OcrDocument.objects.all(), serializers.OcrDocumentSerializer


class AiMessageViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.AiMessage.objects.all(), serializers.AiMessageSerializer


class AiTaskViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.AiTask.objects.all(), serializers.AiTaskSerializer


class AiRecommendationViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.AiRecommendation.objects.all(), serializers.AiRecommendationSerializer


class AiAutomationViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.AiAutomation.objects.all(), serializers.AiAutomationSerializer


class AiNotificationViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.AiNotification.objects.all(), serializers.AiNotificationSerializer


class AiAdGenerationViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.AiAdGeneration.objects.all(), serializers.AiAdGenerationSerializer


# ==========================================
# SUPPORT MODULE
# ==========================================

class TicketViewSet(TenantIsolationMixin, viewsets.ModelViewSet):
    queryset, serializer_class = models.Ticket.objects.all(), serializers.TicketSerializer


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

class GlobalSettingsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        """
        Placeholder for global frontend settings to prevent 404 errors.
        """
        return Response({
            "status": "success",
            "theme": "light",
            "language": "fr"
        })