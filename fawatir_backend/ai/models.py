from datetime import datetime
from decimal import Decimal, InvalidOperation
import uuid

from django.db import models

from api.models import Organization


class Document(models.Model):
  STATUS_PENDING = 'pending'
  STATUS_PROCESSED = 'processed'
  STATUS_FAILED = 'failed'
  STATUS_CHOICES = [
      (STATUS_PENDING, 'Pending'),
      (STATUS_PROCESSED, 'Processed'),
      (STATUS_FAILED, 'Failed'),
  ]

  DOC_TYPE_INVOICE = 'invoice'
  DOC_TYPE_SHIPPING = 'shipping'
  DOC_TYPE_RECEIPT = 'receipt'
  DOC_TYPE_OTHER = 'other'
  DOC_TYPE_CHOICES = [
      (DOC_TYPE_INVOICE, 'Invoice'),
      (DOC_TYPE_SHIPPING, 'Shipping'),
      (DOC_TYPE_RECEIPT, 'Receipt'),
      (DOC_TYPE_OTHER, 'Other'),
  ]

  LANGUE_FR = 'fr'
  LANGUE_EN = 'en'
  LANGUE_AR = 'ar'
  LANGUE_AUTRE = 'autre'
  LANGUE_CHOICES = [
      (LANGUE_FR, 'Français'),
      (LANGUE_EN, 'English'),
      (LANGUE_AR, 'العربية'),
      (LANGUE_AUTRE, 'Autre'),
  ]

  id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
  organization = models.ForeignKey(
      Organization, on_delete=models.CASCADE, related_name='documents'
  )
  file = models.FileField(upload_to='documents/%Y/%m/')
  status = models.CharField(
      max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
  )

  doc_type = models.CharField(
      max_length=20,
      choices=DOC_TYPE_CHOICES,
      null=True,
      blank=True,
      db_index=True,
  )
  langue = models.CharField(
      max_length=10, choices=LANGUE_CHOICES, null=True, blank=True
  )
  fournisseur = models.CharField(max_length=255, null=True, blank=True)
  date = models.DateField(null=True, blank=True)
  numero = models.CharField(max_length=100, null=True, blank=True)
  montant_ttc = models.DecimalField(
      max_digits=15, decimal_places=2, null=True, blank=True
  )

  raw_response = models.JSONField(null=True, blank=True)
  extracted_data = models.JSONField(null=True, blank=True)
  field_confidence = models.JSONField(null=True, blank=True)
  needs_review = models.BooleanField(default=False)

  error_message = models.TextField(null=True, blank=True)

  created_at = models.DateTimeField(auto_now_add=True)
  updated_at = models.DateTimeField(auto_now=True)

  def __str__(self):
    return f'Document {self.id} ({self.status})'

  def promote_fields(self):
    """Extracts promoted fields from extracted_data into model columns safely."""
    data = self.extracted_data or {}
    valid_doc_types = {choice[0] for choice in self.DOC_TYPE_CHOICES}
    valid_langues = {choice[0] for choice in self.LANGUE_CHOICES}

    doc_type = data.get('doc_type')
    self.doc_type = doc_type if doc_type in valid_doc_types else None

    langue = data.get('langue')
    self.langue = langue if langue in valid_langues else None

    self.fournisseur = data.get('fournisseur') or None
    self.numero = data.get('numero') or None

    self.date = None
    raw_date = data.get('date')
    if raw_date:
      try:
        self.date = datetime.strptime(raw_date, '%Y-%m-%d').date()
      except (ValueError, TypeError):
        pass

    self.montant_ttc = None
    raw_ttc = data.get('montant_ttc')
    if raw_ttc is not None:
      try:
        self.montant_ttc = Decimal(str(raw_ttc))
      except (InvalidOperation, ValueError, TypeError):
        pass


class SpreadsheetImport(models.Model):
  STATUS_PENDING = 'pending'
  STATUS_MAPPED = 'mapped'
  STATUS_CONFIRMED = 'confirmed'
  STATUS_FAILED = 'failed'
  STATUS_CHOICES = [
      (STATUS_PENDING, 'Pending'),
      (STATUS_MAPPED, 'Mapped'),
      (STATUS_CONFIRMED, 'Confirmed'),
      (STATUS_FAILED, 'Failed'),
  ]

  id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
  organization = models.ForeignKey(
      Organization,
      on_delete=models.CASCADE,
      related_name='spreadsheet_imports',
  )
  file = models.FileField(upload_to='spreadsheets/%Y/%m/')
  status = models.CharField(
      max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
  )

  data_type = models.CharField(max_length=50, null=True, blank=True)

  column_mapping = models.JSONField(null=True, blank=True)
  sample_rows = models.JSONField(null=True, blank=True)
  normalized_rows = models.JSONField(null=True, blank=True)
  row_count = models.IntegerField(null=True, blank=True)

  needs_review = models.BooleanField(default=True)
  error_message = models.TextField(null=True, blank=True)

  created_at = models.DateTimeField(auto_now_add=True)
  updated_at = models.DateTimeField(auto_now=True)

  def __str__(self):
    return f'SpreadsheetImport {self.id} ({self.status})'