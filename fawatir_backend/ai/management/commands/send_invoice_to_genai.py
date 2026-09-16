import json
import os

from django.core.management.base import BaseCommand, CommandError
from django.core.files.base import ContentFile

from ai.services.genai import post_file_to_service


class Command(BaseCommand):
    help = 'Send an invoice image to the GenAI extractor service and optionally save into a Document.'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Path to the invoice image file')
        parser.add_argument('--service-url', type=str, default=None, help='Override service URL')
        parser.add_argument('--save', action='store_true', help='Save the extracted payload into a Document (requires --company-id)')
        parser.add_argument('--company-id', type=str, default=None, help='Company ID required when using --save')

    def handle(self, *args, **options):
        file_path = options['file_path']
        service_url = options.get('service_url')
        do_save = options.get('save')
        company_id = options.get('company_id')

        if not os.path.exists(file_path):
            raise CommandError(f'File not found: {file_path}')

        self.stdout.write(f'Posting {file_path} to GenAI service...')
        try:
            resp = post_file_to_service(file_path, service_url=service_url)
        except Exception as e:
            raise CommandError(f'Call failed: {e}')

        # Pretty-print the returned payload
        self.stdout.write(json.dumps(resp, indent=2, ensure_ascii=False))

        if do_save:
            if not company_id:
                raise CommandError('--company-id is required when using --save')

            # Lazy import models to avoid startup cost when not saving
            from ai.models import Document
            from api.models import Organization

            try:
                company = Organization.objects.get(pk=company_id)
            except Organization.DoesNotExist:
                raise CommandError(f'Company not found: {company_id}')

            # Create Document with uploaded file and extracted payload
            doc = Document(organization=company)
            with open(file_path, 'rb') as fh:
                django_file = ContentFile(fh.read(), name=os.path.basename(file_path))
                doc.file.save(os.path.basename(file_path), django_file, save=False)

            # The GenAI service returns {'status':..., 'data': {...}, 'checks': {...}}
            data = resp.get('data') or {}
            raw = resp.get('data') or resp

            doc.extracted_data = data
            doc.raw_response = raw
            checks = resp.get('checks') or {}
            doc.needs_review = not checks.get('ok', True)
            doc.status = Document.STATUS_PROCESSED if not doc.needs_review else Document.STATUS_PENDING
            doc.save()

            self.stdout.write(self.style.SUCCESS(f'Saved Document {doc.id} (needs_review={doc.needs_review})'))
