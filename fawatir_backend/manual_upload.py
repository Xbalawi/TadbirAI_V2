import requests
import os

url = 'http://localhost:8000/api/ai/spreadsheets/'
file_path = r'c:\Users\Lenovo\Downloads\FAWATIR\invoice_history_test_data.xlsx'

print(f"Testing upload of {file_path}")

# 1. Create a company first
comp_res = requests.post('http://localhost:8000/api/companies/', json={'name': 'Test Company', 'industry': 'Tech'})
if not comp_res.ok:
    print("Failed to create company", comp_res.status_code, comp_res.text)
    exit(1)
company_id = comp_res.json()['id']
print(f"Created company {company_id}")

# 2. Upload file
with open(file_path, 'rb') as f:
    files = {'file': f}
    data = {'company': company_id}
    res = requests.post(url, files=files, data=data)
    
    print(f"Status Code: {res.status_code}")
    print(res.text)
