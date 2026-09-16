import uuid
from django.db import migrations

def setup_default_organization(apps, schema_editor):
    Organization = apps.get_model('api', 'Organization')
    OrganizationSetting = apps.get_model('api', 'OrganizationSetting')
    
    # Ensure standard default tenant exists
    default_org, created = Organization.objects.get_or_create(
        name="Default Organization",
        defaults={
            "id": uuid.uuid4(),
            "legal_name": "Default Enterprise Ltd",
            "is_active": True,
            "currency": "USD",
            "language": "en"
        }
    )
    
    # Initialize basic Organization Settings for default tenant
    if created or not OrganizationSetting.objects.filter(organization=default_org).exists():
        OrganizationSetting.objects.create(
            id=uuid.uuid4(),
            organization=default_org,
            vat_rate=20.00,
            show_vat=True,
            invoice_prefix="INV-",
            quotation_prefix="QT-",
            purchase_prefix="PO-"
        )

def reverse_setup(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(setup_default_organization, reverse_code=reverse_setup),
    ]