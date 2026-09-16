import os
import django
import sys

# Setup Django environment
sys.path.append(r'c:\Users\Lenovo\Downloads\FAWATIR\fawatir-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fawatir_backend.settings')
django.setup()

from ai.services.ocr import extract_invoice

# Read test image
image_path = r'c:\Users\Lenovo\Downloads\FAWATIR\images.jpg'
if not os.path.exists(image_path):
    print("No test image found.")
    sys.exit(1)

with open(image_path, 'rb') as f:
    file_bytes = f.read()

try:
    print("Running extraction...")
    result = extract_invoice(file_bytes, 'image/jpeg')
    print("Success!")
    print(result['extracted_data'])
except Exception as e:
    print(f"Error occurred: {type(e).__name__}: {e}")
