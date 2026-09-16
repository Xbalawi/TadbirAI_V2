from rest_framework import serializers

from .models import Document, SpreadsheetImport


class DocumentSerializer(serializers.ModelSerializer):

  class Meta:
    model = Document
    fields = [
        'id',
        'organization',
        'file',
        'status',
        'doc_type',
        'langue',
        'fournisseur',
        'date',
        'numero',
        'montant_ttc',
        'extracted_data',
        'field_confidence',
        'needs_review',
        'error_message',
        'created_at',
        'updated_at',
    ]
    read_only_fields = [
        'id',
        'status',
        'doc_type',
        'langue',
        'fournisseur',
        'date',
        'numero',
        'montant_ttc',
        'field_confidence',
        'needs_review',
        'error_message',
        'created_at',
        'updated_at',
    ]


class DocumentCorrectionSerializer(serializers.ModelSerializer):
  """Used for the human-in-the-loop correction endpoint: only extracted_data is editable."""

  class Meta:
    model = Document
    fields = ['extracted_data']


class SpreadsheetImportSerializer(serializers.ModelSerializer):
  """column_mapping (and data_type) are editable via PATCH — that's how the user corrects

  the AI-proposed mapping before calling /confirm/. Everything else is
  read-only/system-set.
  """

  class Meta:
    model = SpreadsheetImport
    fields = [
        'id',
        'organization',
        'file',
        'status',
        'data_type',
        'column_mapping',
        'sample_rows',
        'normalized_rows',
        'row_count',
        'needs_review',
        'error_message',
        'created_at',
        'updated_at',
    ]
    read_only_fields = [
        'id',
        'status',
        'sample_rows',
        'normalized_rows',
        'row_count',
        'needs_review',
        'error_message',
        'created_at',
        'updated_at',
    ]