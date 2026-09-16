import os
import django
import sys
import pandas as pd
import io

sys.path.append(r'c:\Users\Lenovo\Downloads\FAWATIR\fawatir-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fawatir_backend.settings')
django.setup()

from ai.services.spreadsheet import parse_spreadsheet, propose_mapping, apply_mapping

def run_test():
    filepath = r'C:\Users\Lenovo\Downloads\FAWATIR\invoice_history_test_data.xlsx'
    print(f"Reading Excel file: {filepath}")
    
    with open(filepath, 'rb') as f:
        excel_bytes = f.read()
    
    print("Parsing Excel file...")
    headers, rows = parse_spreadsheet(excel_bytes)
    print(f"Found headers: {headers}")
    print(f"Found {len(rows)} rows. Sample of first row: {rows[0] if rows else 'Empty'}")
    
    print("\nRequesting AI mapping proposal from Gemini...")
    mapping_result = propose_mapping(headers, rows)
    
    print(f"\nAI Data Type Classification: {mapping_result['data_type']}")
    print("AI Column Mapping:")
    for col in mapping_result['columns']:
        print(f"  - {col['source_column']} -> {col['field_name']} (Label: {col['label']})")
        
    print("\nApplying Mapping to rows...")
    normalized = apply_mapping(rows, mapping_result['columns'])
    if normalized:
        print(f"Normalized Row 1: {normalized[0]}")

if __name__ == "__main__":
    run_test()
