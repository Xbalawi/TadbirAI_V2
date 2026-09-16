import json
import logging
from typing import Optional

from django.conf import settings
try:
    from google import genai
except (ImportError, ModuleNotFoundError):
    genai = None
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.7
ARITHMETIC_TOLERANCE = 0.5

class DocumentLine(BaseModel):
    description: str = Field(description="Description of the item or service")
    quantite: Optional[float] = Field(description="Quantity")
    prix_unitaire: Optional[float] = Field(description="Unit price")
    montant: Optional[float] = Field(description="Total amount for this line")

class DocumentData(BaseModel):
    doc_type: str = Field(description="'invoice' or 'shipping' or 'receipt' or 'other'")
    langue: str = Field(description="Detected language code, e.g. 'fr', 'en', 'ar', or 'autre'")
    fournisseur: Optional[str] = Field(description="Name of the supplier or emitting company")
    date: Optional[str] = Field(description="Date in YYYY-MM-DD format")
    numero: Optional[str] = Field(description="Document/Invoice number")
    montant_ht: Optional[float] = Field(description="Total excluding taxes (Subtotal / HT)")
    montant_tva: Optional[float] = Field(description="Tax amount in currency (not percentage)")
    montant_ttc: Optional[float] = Field(description="Grand total including taxes (TTC)")
    lignes: list[DocumentLine] = Field(description="List of items/lines")

FIELD_NAMES = [
    'doc_type', 'langue', 'fournisseur', 'date', 'numero',
    'montant_ht', 'montant_tva', 'montant_ttc', 'lignes',
]

class OCRExtractionError(Exception):
    pass

def _fill_missing_amount(parsed: dict):
    ht, tva, ttc = parsed.get('montant_ht'), parsed.get('montant_tva'), parsed.get('montant_ttc')

    if ht is None and tva is not None and ttc is not None:
        parsed['montant_ht'] = round(ttc - tva, 2)
    elif tva is None and ht is not None and ttc is not None:
        parsed['montant_tva'] = round(ttc - ht, 2)
    elif ttc is None and ht is not None and tva is not None:
        parsed['montant_ttc'] = round(ht + tva, 2)
    return parsed

def _validate_arithmetic(parsed: dict, confidence: dict):
    ht = parsed.get('montant_ht')
    tva = parsed.get('montant_tva')
    ttc = parsed.get('montant_ttc')
    lignes = parsed.get('lignes') or []

    if ht is not None and tva is not None and ttc is not None:
        if abs((ht + tva) - ttc) > ARITHMETIC_TOLERANCE:
            for field in ('montant_ht', 'montant_tva', 'montant_ttc'):
                confidence[field] = min(confidence.get(field, 0.9), 0.4)

    lignes_total = sum(l.get('montant') or 0 for l in lignes)
    if lignes and ht is not None and abs(lignes_total - ht) > ARITHMETIC_TOLERANCE:
        confidence['lignes'] = min(confidence.get('lignes', 0.9), 0.4)

    return confidence

def extract_invoice(file_bytes: bytes, mime_type: str):
    from google.genai import types  # Import types for the new SDK configuration
    
    if not settings.GEMINI_API_KEY:
        raise OCRExtractionError("GEMINI_API_KEY is not set. Please configure it in .env")
    
    # Initialize the new client with the API key
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    prompt = """
    Extract structured data from this document. It could be an invoice, receipt, shipping document, etc.
    Pay careful attention to the language (can be French, Arabic, English, or mixed).
    
    Rules:
    - 'fournisseur': The company EMITTING the document. Do not confuse it with the client/billed-to.
    - 'montant_ht': Total before taxes (HT, Subtotal).
    - 'montant_tva': The actual tax amount in currency (NOT the percentage rate). 
    - 'montant_ttc': The grand total including taxes (TTC).
    - If a field is illegible or missing, use null.
    """
    
    try:
        # Use the new Google GenAI client structure and types
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                prompt,
                types.Part.from_bytes(
                    data=file_bytes,
                    mime_type=mime_type,
                ),
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=DocumentData,
                temperature=0.0,
            )
        )
    except Exception as exc:
        raise OCRExtractionError(f"Gemini API request failed: {exc}") from exc
        
    try:
        parsed = json.loads(response.text)
    except Exception as exc:
        raise OCRExtractionError(f"Failed to parse Gemini response: {exc}") from exc

    # Fill missing amounts and prepare confidence
    parsed = _fill_missing_amount(parsed)
    
    # Assign baseline confidence
    confidence = {}
    for field in FIELD_NAMES:
        val = parsed.get(field)
        if val in (None, '', []):
            confidence[field] = 0.0
        else:
            confidence[field] = 0.9
            
    confidence = _validate_arithmetic(parsed, confidence)
    
    needs_review = any(confidence[field] < CONFIDENCE_THRESHOLD for field in FIELD_NAMES)

    return {
        'extracted_data': parsed,
        'field_confidence': confidence,
        'needs_review': needs_review,
        'raw_response': {
            'model_response': response.text,
        },
    }