import os
import django
import sys

sys.path.append(r'c:\Users\Lenovo\Downloads\FAWATIR\fawatir-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fawatir_backend.settings')
django.setup()

from ai.models import Document

docs = Document.objects.all().order_by('-created_at')
for d in docs:
    print(f"ID: {d.id} | File: {d.file.name} | Status: {d.status} | Error: {d.error_message}")
    if d.status == 'failed' or (d.extracted_data is None and d.status != 'pending'):
        pass
