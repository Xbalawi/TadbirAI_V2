import io
import json
import math
import sys
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch
from django.urls import reverse
from api.models import User as TenantUser, Role
# Fake pytesseract module to prevent import issues in CI
sys.modules['pytesseract'] = MagicMock()

import openpyxl
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image

from ai.models import Document, SpreadsheetImport
from ai.services.forecast import InsufficientHistoryError, forecast_cashflow
from ai.services.ocr import OCRExtractionError, extract_invoice
from ai.services.spreadsheet import (
    SpreadsheetError,
    apply_mapping,
    parse_spreadsheet,
    propose_mapping,
)
from api.models import Organization


def _tiny_png_bytes():
    buf = io.BytesIO()
    Image.new('RGB', (10, 10), color='white').save(buf, format='PNG')
    return buf.getvalue()


def _fake_gemini_response(payload_text):
    mock_resp = MagicMock()
    mock_resp.text = payload_text
    return mock_resp


CONSISTENT_PAYLOAD = {
    'doc_type': 'invoice',
    'langue': 'fr',
    'fournisseur': 'ACME SARL',
    'date': '2026-06-01',
    'numero': 'F-2026-001',
    'montant_ht': 100.0,
    'montant_tva': 20.0,
    'montant_ttc': 120.0,
    'lignes': [{'description': 'Service A', 'quantite': 1, 'prix_unitaire': 100.0, 'montant': 100.0}],
}


@override_settings(GEMINI_API_KEY='dummy-key-for-tests')
class ExtractInvoiceTests(TestCase):
    @patch('google.genai.Client')
    def test_consistent_invoice_does_not_need_review(self, mock_gemini):
        mock_gemini.return_value.models.generate_content.return_value = _fake_gemini_response(json.dumps(CONSISTENT_PAYLOAD))

        result = extract_invoice(_tiny_png_bytes(), 'image/jpeg')

        self.assertFalse(result['needs_review'])
        self.assertEqual(result['extracted_data']['fournisseur'], 'ACME SARL')
        self.assertEqual(result['extracted_data']['montant_ttc'], 120.0)
        self.assertEqual(result['extracted_data']['doc_type'], 'invoice')

    @patch('google.genai.Client')
    def test_arithmetic_mismatch_flags_for_review(self, mock_gemini):
        payload = dict(CONSISTENT_PAYLOAD)
        payload['montant_ttc'] = 999.0  # inconsistent
        mock_gemini.return_value.models.generate_content.return_value = _fake_gemini_response(json.dumps(payload))

        result = extract_invoice(_tiny_png_bytes(), 'image/jpeg')
        self.assertTrue(result['needs_review'])
        self.assertLess(result['field_confidence']['montant_ttc'], 0.7)

    @patch('google.genai.Client')
    def test_missing_field_flags_for_review(self, mock_gemini):
        payload = dict(CONSISTENT_PAYLOAD)
        payload['numero'] = None
        mock_gemini.return_value.models.generate_content.return_value = _fake_gemini_response(json.dumps(payload))

        result = extract_invoice(_tiny_png_bytes(), 'image/jpeg')
        self.assertTrue(result['needs_review'])
        self.assertEqual(result['field_confidence']['numero'], 0.0)

    @patch('google.genai.Client')
    def test_invalid_json_raises_extraction_error(self, mock_gemini):
        mock_gemini.return_value.models.generate_content.return_value = _fake_gemini_response('this is not json')
        with self.assertRaises(OCRExtractionError):
            extract_invoice(_tiny_png_bytes(), 'image/jpeg')

    @patch('google.genai.Client')
    def test_no_text_detected_raises(self, mock_gemini):
        mock_gemini.return_value.models.generate_content.side_effect = Exception('Gemini extraction failed')
        with self.assertRaises(OCRExtractionError):
            extract_invoice(_tiny_png_bytes(), 'image/jpeg')

    @patch('google.genai.Client')
    def test_ollama_unreachable_raises(self, mock_gemini):
        mock_gemini.return_value.models.generate_content.side_effect = Exception('connection refused')
        with self.assertRaises(OCRExtractionError):
            extract_invoice(_tiny_png_bytes(), 'image/jpeg')

    def test_pdf_not_supported_raises(self):
        with self.assertRaises(OCRExtractionError):
            extract_invoice(b'%PDF-fake', 'application/pdf')

    @patch('google.genai.Client')
    def test_pattern_match_overrides_wrong_llm_amount(self, mock_gemini):
        payload = dict(CONSISTENT_PAYLOAD)
        payload['montant_ht'] = None  # Missing field to be computed via _fill_missing_amount
        payload['montant_tva'] = 9.06
        payload['montant_ttc'] = 154.06
        payload['lignes'] = [{'description': 'Service A', 'quantite': 1, 'prix_unitaire': 145.0, 'montant': 145.0}]
        mock_gemini.return_value.models.generate_content.return_value = _fake_gemini_response(json.dumps(payload))

        result = extract_invoice(_tiny_png_bytes(), 'image/jpeg')
        self.assertEqual(result['extracted_data']['montant_ht'], 145.0)
        self.assertEqual(result['extracted_data']['montant_tva'], 9.06)
        self.assertEqual(result['extracted_data']['montant_ttc'], 154.06)


class PromoteFieldsTests(TestCase):
    def setUp(self):
        self.organisation = Organization.objects.create(name='Test Co')

    def _document(self, extracted_data):
        return Document.objects.create(organization=self.organisation, extracted_data=extracted_data)

    def test_promotes_valid_fields(self):
        doc = self._document({
            'doc_type': 'invoice', 'langue': 'en', 'fournisseur': 'ACME SARL',
            'date': '2026-06-01', 'numero': 'F-2026-001', 'montant_ttc': 120.5,
        })
        doc.promote_fields()
        self.assertEqual(doc.doc_type, 'invoice')
        self.assertEqual(doc.montant_ttc, Decimal('120.5'))

    def test_invalid_doc_type_and_langue_become_none(self):
        doc = self._document({'doc_type': 'not-a-real-type', 'langue': 'klingon'})
        doc.promote_fields()
        self.assertIsNone(doc.doc_type)

    def test_missing_extracted_data_does_not_raise(self):
        doc = self._document(None)
        doc.promote_fields()
        self.assertIsNone(doc.doc_type)


def _xlsx_bytes(headers, rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(headers)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


class ParseSpreadsheetTests(TestCase):
    def test_parses_headers_and_rows(self):
        content = _xlsx_bytes(['Nom du produit', 'Prix'], [['Vis 4mm', 0.5], ['Ecrou 4mm', 0.3]])
        headers, rows = parse_spreadsheet(content)
        self.assertEqual(headers, ['Nom du produit', 'Prix'])
        self.assertEqual(rows, [{'Nom du produit': 'Vis 4mm', 'Prix': 0.5}, {'Nom du produit': 'Ecrou 4mm', 'Prix': 0.3}])

    def test_empty_sheet_raises(self):
        content = _xlsx_bytes(['A', 'B'], [])
        with self.assertRaises(SpreadsheetError):
            parse_spreadsheet(content)


class ApplyMappingTests(TestCase):
    def test_renames_keys_per_mapping(self):
        rows = [{'Nom': 'Vis', 'Prix EUR': 0.5}]
        mapping = [
            {'source_column': 'Nom', 'field_name': 'product_name', 'label': 'Nom'},
            {'source_column': 'Prix EUR', 'field_name': 'unit_price', 'label': 'Prix'},
        ]
        result = apply_mapping(rows, mapping)
        self.assertEqual(result, [{'product_name': 'Vis', 'unit_price': 0.5}])

    def test_ignored_column_is_dropped(self):
        rows = [{'Nom': 'Vis', 'Notes internes': 'secret'}]
        mapping = [
            {'source_column': 'Nom', 'field_name': 'product_name', 'label': 'Nom'},
            {'source_column': 'Notes internes', 'field_name': 'UNMAPPED', 'label': 'Notes internes'},
        ]
        result = apply_mapping(rows, mapping)
        self.assertEqual(result, [{'product_name': 'Vis'}])


@override_settings(GEMINI_API_KEY='dummy-key-to-prevent-fallback')
class ProposeMappingTests(TestCase):
    @patch('google.genai.Client')
    def test_valid_model_response_is_used_as_is(self, mock_gemini):
        payload = {
            'data_type': 'products',
            'columns': [
                {'source_column': 'Nom du produit', 'field_name': 'product_name', 'label': 'Nom du produit'},
                {'source_column': 'Prix', 'field_name': 'unit_price', 'label': 'Prix'},
            ],
        }
        mock_gemini.return_value.models.generate_content.return_value = _fake_gemini_response(json.dumps(payload))

        result = propose_mapping(['Nom du produit', 'Prix'], [{'Nom du produit': 'Vis', 'Prix': 0.5}])
        self.assertEqual(result['data_type'], 'products')
        self.assertEqual(result['columns'][0]['field_name'], 'product_name')

    @patch('google.genai.Client')
    def test_malformed_response_falls_back_to_slugified_headers(self, mock_gemini):
        mock_gemini.return_value.models.generate_content.return_value = _fake_gemini_response('this is not json')
        result = propose_mapping(['Nom du Produit!', 'Prix (EUR)'], [])
        self.assertEqual(result['data_type'], 'other')
        self.assertEqual(result['columns'][0]['field_name'], 'nom_du_produit')

    @patch('google.genai.Client')
    def test_gemini_unreachable_raises(self, mock_gemini):
        mock_gemini.return_value.models.generate_content.side_effect = Exception('connection refused')
        result = propose_mapping(['A'], [])
        self.assertEqual(result['data_type'], 'other')


@override_settings(GEMINI_API_KEY='dummy-key-to-prevent-fallback')
class SpreadsheetImportViewTests(TestCase):
    def setUp(self):
        super().setUp()
        from django.contrib.auth.models import User as AuthUser
        from api.models import User as TenantUser
        from rest_framework.test import APIClient
        
        # 1. Create the test organization
        self.organisation = Organization.objects.create(name="Test Corp")
        
        # 2. Create the default Django user (what JWT actually authenticates)
        auth_user = AuthUser.objects.create_user(username="ci_test", email="ci@test.com")
        
        test_role = Role.objects.create(display_name="Test Role", organisation=self.organisation)
        TenantUser.objects.create(email="ci@test.com", organisation=self.organisation, role=test_role)
        
        # 4. Force authenticate the test client to bypass the 401 error
        self.client = APIClient()
        self.client.force_authenticate(user=auth_user)

    @patch('google.genai.Client')
    def test_upload_then_confirm_full_flow(self, mock_gemini):
        mapping_response = {
            'data_type': 'products',
            'columns': [
                {'source_column': 'Nom du produit', 'field_name': 'product_name', 'label': 'Nom du produit'},
                {'source_column': 'Prix', 'field_name': 'unit_price', 'label': 'Prix'},
            ],
        }
        mock_gemini.return_value.models.generate_content.return_value = _fake_gemini_response(json.dumps(mapping_response))

        content = _xlsx_bytes(['Nom du produit', 'Prix'], [['Vis 4mm', 0.5], ['Ecrou 4mm', 0.3]])
        upload = SimpleUploadedFile(
            'products.xlsx', content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )

        response = self.client.post('/api/ai/spreadsheets/', {
            'organization': self.organisation.id, 
            'file': upload
        })
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body['status'], 'mapped')

        import_id = body['id']
        confirm_response = self.client.post(f'/api/ai/spreadsheets/{import_id}/confirm/')
        self.assertEqual(confirm_response.status_code, 200)
        confirmed = confirm_response.json()
        self.assertEqual(confirmed['status'], 'confirmed')
        self.assertEqual(confirmed['normalized_rows'], [
            {'product_name': 'Vis 4mm', 'unit_price': 0.5},
            {'product_name': 'Ecrou 4mm', 'unit_price': 0.3},
        ])


def _synthetic_history(num_days, start_value=1000.0, daily_growth=5.0, weekly_amplitude=50.0):
    history = []
    start = date(2026, 1, 1)
    for i in range(num_days):
        d = start + timedelta(days=i)
        seasonal = weekly_amplitude * math.sin(2 * math.pi * (i % 7) / 7)
        amount = start_value + daily_growth * i + seasonal
        history.append({'date': d.strftime('%Y-%m-%d'), 'amount': amount})
    return history


class ForecastCashflowTests(TestCase):
    def test_insufficient_history_raises(self):
        with self.assertRaises(InsufficientHistoryError):
            forecast_cashflow(_synthetic_history(5), horizon_days=7)

    def test_forecast_shape(self):
        result = forecast_cashflow(_synthetic_history(60), horizon_days=14)
        self.assertEqual(len(result['forecast']), 14)