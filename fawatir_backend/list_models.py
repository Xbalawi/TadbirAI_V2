import os
import django
import sys

sys.path.append(r'c:\Users\Lenovo\Downloads\FAWATIR\fawatir-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fawatir_backend.settings')
django.setup()

import google.generativeai as genai
from django.conf import settings

genai.configure(api_key=settings.GEMINI_API_KEY, transport='rest')
for m in genai.list_models():
    print(m.name, m.supported_generation_methods)
