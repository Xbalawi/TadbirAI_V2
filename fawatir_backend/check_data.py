import os
import django
import sys

sys.path.append(r'c:\Users\Lenovo\Downloads\FAWATIR\fawatir-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fawatir_backend.settings')
django.setup()

from ai.models import Document

docs = Document.objects.filter(status='processed').order_by('-created_at')[:3]
for d in docs:
    print(f"File: {d.file.name}")
    print(f"Extracted Data: {d.extracted_data}")
    print(f"Needs review: {d.needs_review}")
    print("-" * 40)
