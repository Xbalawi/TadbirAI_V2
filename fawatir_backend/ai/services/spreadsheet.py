import io
import json
import re
import datetime
from typing import Optional, Literal

import pandas as pd
from django.conf import settings
from google import genai
from pydantic import BaseModel, Field


TARGET_SCHEMAS = {
    "stock": ["product_name", "description", "sku", "barcode", "brand", "unit", "purchase_price", "selling_price", "tax_rate", "minimum_stock", "weight", "stock_quantity", "warehouse_location", "category_name", "supplier_name", "status"],
    "clients": ["customer_code", "company_name", "contact_name", "email", "phone", "mobile", "website", "tax_identifier", "ice", "rc", "address", "city", "postal_code", "country", "credit_limit", "notes"],
    "suppliers": ["supplier_code", "company_name", "contact_name", "email", "phone", "mobile", "website", "tax_identifier", "ice", "rc", "address", "city", "postal_code", "country", "notes"],
    "invoices": ["invoice_number", "issue_date", "due_date", "status", "subtotal", "tax_amount", "discount_amount", "total_amount", "balance_due", "notes", "terms", "client", "client_email", "description", "quantity", "unit_price", "payment_method"],
    "inventory": ["product_name", "variant_name", "quantity", "reserved_quantity", "available_quantity", "reorder_level", "warehouse_location"],
}

MAX_PROMPT_ROWS = 10

MAPPING_PROMPT_TEMPLATE = """You are an expert data architect responsible for migrating messy, unpredictable user CSV/Excel files into a strict relational database schema. 

Your task is to analyze the incoming columns and map them to the correct target database column.

### TARGET COLUMNS
Here are the exact schemas of our database for each data type.
<schemas>
{schemas}
</schemas>

### INPUT DATA
- Incoming Headers: {headers}
- Sample Data: {sample_rows}

### RULES
1. Guess the data_type (products, clients, suppliers, invoices, inventory, or other).
2. Analyze both the Incoming Headers AND the Sample Data. **Trust the Header names primarily**.
3. Use the Sample Data to confirm the header, or to figure out what a column is if the header is generic.
4. You may ONLY map to one of the exact column names available in the <schemas> list for the detected data type.
5. If the Header matches a target column well, map it and assign a high confidence score (> 0.90).
6. If the Source Header and Sample Data do not logically match ANY of the Target Columns, you MUST output null or "UNMAPPED" for the field_name. Do not force a bad fit.
7. Provide a short 2-3 sentence analysis of the entire dataset.

Output strictly in the requested JSON format."""


class ColumnMapping(BaseModel):
    source_column: str = Field(description="The original header name provided in the user's file.")
    field_name: str = Field(description="The exact database column this maps to. MUST be one of the target schema fields or 'UNMAPPED'.")
    label: str = Field(description="A human-readable label for this column (usually just the source column).")
    confidence_score: float = Field(description="A score from 0.0 to 1.0 indicating how confident you are in this mapping.")
    reasoning: str = Field(description="A brief, 1-sentence explanation of why this mapping was chosen based on the header and sample data.")

class MappingResponse(BaseModel):
    data_type: Literal['stock', 'products', 'suppliers', 'clients', 'inventory', 'invoices', 'other'] = Field(description="Classification")
    columns: list[ColumnMapping]
    analysis: str = Field(description="A short, intelligent human-like summary of what this dataset represents.")


class SpreadsheetError(Exception):
    pass


def _to_native(value):
    """Converts a pandas/numpy scalar to a plain JSON-serializable Python value."""
    if pd.isna(value):
        return None
    if hasattr(value, 'item'):  # numpy scalar (int64, float64, bool_, ...)
        value = value.item()
    if isinstance(value, (pd.Timestamp, datetime.datetime, datetime.date)):
        return value.strftime('%Y-%m-%d')
    return value


def parse_spreadsheet(file_bytes):
    """Reads the first sheet of an Excel file.

    Returns (headers, rows) — rows is a list of dicts keyed by the ORIGINAL column headers,
    with values converted to plain JSON-serializable Python types.
    """
    try:
        # Read without headers first to find the real header row
        df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=0, engine='openpyxl', header=None)
    except Exception as exc:
        raise SpreadsheetError(f'Could not read spreadsheet: {exc}') from exc

    if df.empty:
        raise SpreadsheetError('The spreadsheet has no data rows')

    # Drop completely empty rows and columns
    df = df.dropna(how='all').dropna(axis=1, how='all')
    df = df.reset_index(drop=True)

    if df.empty:
        raise SpreadsheetError('The spreadsheet has no data rows')

    # Smart header detection: find the row with the most non-null cells in the first 15 rows
    header_idx = 0
    max_non_null = 0
    for i in range(min(15, len(df))):
        non_null_count = df.iloc[i].notna().sum()
        if non_null_count > max_non_null:
            max_non_null = non_null_count
            header_idx = i

    # Extract the headers
    raw_headers = df.iloc[header_idx]
    headers = []
    seen = set()
    for i, c in enumerate(raw_headers):
        val = str(c).strip() if pd.notnull(c) else f"Unnamed_{i}"
        # Ensure unique headers
        original_val = val
        counter = 1
        while val in seen:
            val = f"{original_val}_{counter}"
            counter += 1
        seen.add(val)
        headers.append(val)

    # The data is everything after the header row
    df = df.iloc[header_idx + 1:]
    df.columns = headers
    
    # Extract structural info
    df = df.where(pd.notnull(df), None)
    
    rows = [
        {header: _to_native(value) for header, value in zip(headers, record)}
        for record in df.itertuples(index=False, name=None)
    ]
    
    if not rows:
        raise SpreadsheetError("The uploaded spreadsheet is empty.")
        
    return headers, rows


def _slugify(text):
    slug = re.sub(r'[^a-z0-9]+', '_', str(text).strip().lower()).strip('_')
    return slug or 'column'


def _fallback_columns(headers):
    """Used when the model's response is malformed."""
    columns = []
    for header in headers:
        columns.append({
            'source_column': header, 
            'field_name': _slugify(header),  # Fallback maps to slugified header
            'label': header,
            'confidence_score': 0.0,
            'reasoning': 'System fallback due to processing error.'
        })
    return columns


def propose_mapping(headers: list[str], sample_rows: list[dict], expected_type: str = None) -> dict:
    """
    Calls Gemini to intelligently map spreadsheet headers to Fawatir schemas.
    If expected_type is provided, it forces the AI to map it to that type.
    """
    from google.genai import types  # Import new SDK types
    
    if not settings.GEMINI_API_KEY:
        return {'data_type': 'other', 'columns': _fallback_columns(headers)}

    # Initialize the new client 
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    if expected_type and expected_type in TARGET_SCHEMAS:
        schemas_to_pass = {expected_type: TARGET_SCHEMAS[expected_type]}
    else:
        schemas_to_pass = TARGET_SCHEMAS

    prompt = MAPPING_PROMPT_TEMPLATE.format(
        schemas=json.dumps(schemas_to_pass, indent=2),
        headers=json.dumps(headers, ensure_ascii=False),
        sample_rows=json.dumps(sample_rows[:MAX_PROMPT_ROWS], ensure_ascii=False, default=str),
    )

    try:
        # Use the new client configuration structure
        response = client.models.generate_content(
            model='gemini-2.5-flash', # Updated to the standard modern model 
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=MappingResponse,
                temperature=0.0,
            )
        )
        
        response_text = response.text.strip()
        
        # Clean markdown code blocks if the model wrapped the JSON
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
            
        parsed = json.loads(response_text.strip())
        return parsed
        
    except Exception as e:
        # If model crashes or returns invalid JSON, gracefully fallback
        # or bubble up error if it's an API failure. For now, fallback to safe structural mapping
        return {
            'data_type': 'other', 
            'columns': _fallback_columns(headers), 
            'analysis': f'Fallback used due to AI Error: {str(e)}'
        }
        
    data_type = parsed.get('data_type') if isinstance(parsed, dict) else 'other'
    columns = parsed.get('columns') if isinstance(parsed, dict) else None
    analysis = parsed.get('analysis') if isinstance(parsed, dict) else 'No analysis generated.'

    # Guarantee uniqueness of mapped columns (excluding UNMAPPED/None)
    if isinstance(columns, list):
        seen = set()
        clean_columns = []
        for col in columns:
            if not isinstance(col, dict):
                continue
                
            field_name = col.get('field_name')
            source_col = col.get('source_column') or col.get('source_header')
            
            if field_name and str(field_name).upper() != 'UNMAPPED':
                field_name = re.sub(r'[^a-z0-9_]', '_', str(field_name).lower()).strip('_')
                if field_name:
                    original_mapped = field_name
                    counter = 2
                    while field_name in seen:
                        field_name = f'{original_mapped}_{counter}'
                        counter += 1
                    seen.add(field_name)
            else:
                field_name = None
            
            clean_columns.append({
                'source_column': source_col,
                'field_name': field_name,
                'label': col.get('label') or source_col,
                'confidence_score': col.get('confidence_score', 0.0),
                'reasoning': col.get('reasoning', '')
            })
        columns = clean_columns

    if not columns or len(columns) != len(headers):
        columns = _fallback_columns(headers)

    return {
        'data_type': data_type,
        'analysis': analysis,
        'columns': columns
    }


def apply_mapping(rows, column_mapping):
    """Renames every row's keys per column_mapping; unmapped columns are dropped."""
    normalized = []
    for row in rows:
        new_row = {}
        for col in column_mapping:
            field_name = col.get('field_name')
            if field_name and field_name != 'UNMAPPED':
                source_col = col.get('source_column')
                # Transfer the value from the old row using the source column name
                new_row[field_name] = row.get(source_col)
        normalized.append(new_row)
    return normalized
