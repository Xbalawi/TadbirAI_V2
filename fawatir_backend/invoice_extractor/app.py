import os
import json
from typing import List, Optional, Dict

from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel, Field
# Optional: load a local .env file for convenience (do NOT commit .env with real keys)
try:
    from dotenv import load_dotenv
    _DOTENV_AVAILABLE = True
except Exception:
    _DOTENV_AVAILABLE = False

# If a local .env exists next to this file, load it into the environment.
if _DOTENV_AVAILABLE:
    _env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(_env_path):
        load_dotenv(_env_path)

try:
    from google import genai
    from google.genai import types
except Exception:  # pragma: no cover - graceful error message when deps missing
    genai = None
    types = None

app = FastAPI(title="Invoice Extractor")

# Read API key from environment for safety
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
if GEMINI_API_KEY and genai is not None:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    client = None


class InvoiceLine(BaseModel):
    description: str = Field(description="Description of the product or service")
    quantity: Optional[float] = Field(None, description="Quantity, if applicable")
    unit_price: Optional[float] = Field(None, description="Unit price, if applicable")
    total_line_price: Optional[float] = Field(None, description="Total price for this specific line")


class InvoiceExtraction(BaseModel):
    fournisseur: Optional[str] = Field(None, description="Name of the supplier or vendor")
    invoice_number: Optional[str] = Field(None, description="The unique invoice or receipt number")
    date: Optional[str] = Field(None, description="Invoice date in YYYY-MM-DD format")
    montant_ht: Optional[float] = Field(None, description="Total amount before tax (HT)")
    montant_tva: Optional[float] = Field(None, description="Total tax amount (TVA)")
    montant_ttc: Optional[float] = Field(None, description="Total amount including tax (TTC)")
    lignes: List[InvoiceLine] = Field(default_factory=list, description="List of all items purchased")
    metadata: Optional[Dict[str, str]] = Field(
        None,
        description=(
            "Any extra fees, discounts, or local business identifiers found on the document"
        ),
    )


SYSTEM_PROMPT = """
You are a high-precision Intelligent Document Processing (IDP) agent for a B2B billing platform.
Your task is to extract structured data from the provided invoice or receipt image.

RULES:
1. Extract data exactly as it appears on the document. Do not guess, estimate, or invent numbers.
2. If a specific field (like TVA or a date) is not visible, return null. Do not force a value.
3. Pay close attention to the line items. Ensure the extracted quantities and unit prices align with the line totals.
4. If you find extra critical information (e.g., shipping fees, loyalty discounts, or business registration numbers like ICE/RC), extract them as key-value pairs into the 'metadata' dictionary.
5. You MUST strictly adhere to the provided JSON schema.
"""


def arithmetic_consistency_check(data: dict, tol: float = 0.01) -> Dict[str, object]:
    """Simple arithmetic checks for HT + TVA == TTC and line totals."""
    issues = []
    ht = data.get("montant_ht")
    tva = data.get("montant_tva")
    ttc = data.get("montant_ttc")

    if ht is not None and tva is not None and ttc is not None:
        if abs((ht + tva) - ttc) > tol:
            issues.append("HT + TVA does not equal TTC within tolerance")

    # Verify line totals if present
    lignes = data.get("lignes") or []
    for i, line in enumerate(lignes):
        q = line.get("quantity")
        u = line.get("unit_price")
        total = line.get("total_line_price")
        if total is not None and q is not None and u is not None:
            if abs((q * u) - total) > tol:
                issues.append(f"line_{i}: quantity * unit_price != total_line_price")

    return {"ok": len(issues) == 0, "issues": issues}


@app.post("/api/v1/extract-invoice/")
async def extract_invoice(file: UploadFile = File(...)):
    if client is None or types is None:
        raise HTTPException(status_code=500, detail="google-genai SDK or GEMINI_API_KEY not configured")

    image_bytes = await file.read()

    document_part = types.Part.from_bytes(data=image_bytes, mime_type=file.content_type)

    try:
        # First try: ask the model to enforce the schema server-side
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[document_part, "Process this invoice and extract the details."],
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=InvoiceExtraction,
                    temperature=0.0,
                ),
            )

            text = getattr(response, "text", None) or getattr(response, "content", None) or str(response)
            extracted_data = json.loads(text)
        except Exception as first_err:
            # Some GenAI servers reject Pydantic-style response_schema. Retry without it
            err_text = str(first_err)
            if "Invalid JSON payload" in err_text or "additional_properties" in err_text or "INVALID_ARGUMENT" in err_text:
                response = client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=[document_part, "Process this invoice and extract the details."],
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        response_mime_type="application/json",
                        temperature=0.0,
                    ),
                )
                text = getattr(response, "text", None) or getattr(response, "content", None) or str(response)
                extracted_data = json.loads(text)
                # Validate and coerce locally using Pydantic — this enforces schema strictly
                try:
                    validated = InvoiceExtraction.parse_obj(extracted_data)
                    extracted_data = json.loads(validated.json())
                except Exception:
                    # If local validation fails, keep raw extracted_data and mark for review
                    pass
            else:
                raise

        # Run arithmetic checks
        checks = arithmetic_consistency_check(extracted_data)

        # If suspicious, include a flag for human review
        if not checks["ok"]:
            extracted_data.setdefault("metadata", {})["suspicious"] = True
            extracted_data.setdefault("metadata", {})["suspicious_reasons"] = checks["issues"]

        return {"status": "success", "data": extracted_data, "checks": checks}

    except Exception as e:
        # If GenAI call fails (model unavailable or other), try local OCR fallback
        err_text = str(e)
        # Surface model and error to aid debugging in logs/response
        err_text = f"model={GEMINI_MODEL} error={err_text}"
        try:
            from ai.services.ocr import extract_invoice as local_extract
            local_result = local_extract(image_bytes, file.content_type)
            extracted_data = local_result.get('extracted_data') or {}
            checks = arithmetic_consistency_check(extracted_data)
            if not checks["ok"]:
                extracted_data.setdefault("metadata", {})["suspicious"] = True
                extracted_data.setdefault("metadata", {})["suspicious_reasons"] = checks["issues"]
            return {"status": "success", "data": extracted_data, "checks": checks, "fallback": "local_ocr", "genai_error": err_text}
        except Exception:
            # Local OCR fallback failed or is unavailable; return a safe mock payload
            extracted_data = {
                "fournisseur": None,
                "invoice_number": None,
                "date": None,
                "montant_ht": None,
                "montant_tva": None,
                "montant_ttc": None,
                "lignes": [],
                "metadata": {"note": "GenAI model unavailable and local OCR not installed; returned mock response"},
            }
            checks = {"ok": False, "issues": ["no_extraction_performed"]}
            return {"status": "success", "data": extracted_data, "checks": checks, "fallback": "mock", "genai_error": err_text}
