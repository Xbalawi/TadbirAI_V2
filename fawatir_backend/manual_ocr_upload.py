import requests
import os

url = 'http://localhost:8000/api/ai/documents/'
file_path = r'c:\Users\Lenovo\Downloads\FAWATIR\invoice_history_test_data.xlsx' # wait, OCR needs an image!

print("Fetching companies...")
comp_res = requests.get('http://localhost:8000/api/companies/')
if not comp_res.ok:
    print("Failed to get companies", comp_res.text)
    exit(1)
company_id = comp_res.json()[0]['id']

# Create a dummy image
with open('dummy.png', 'wb') as f:
    f.write(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0bIDAT\x08\x99c\xf8\x0f\x04\x00\x09\xfb\x03\xfd\xe3U\xf2\x9c\x00\x00\x00\x00IEND\xaeB`\x82')

print("Uploading dummy image...")
with open('dummy.png', 'rb') as f:
    files = {'file': ('dummy.png', f, 'image/png')}
    data = {'company': company_id}
    res = requests.post(url, files=files, data=data)
    
    print(f"Status Code: {res.status_code}")
    print(res.text)
