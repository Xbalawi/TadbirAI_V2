# Invoice Extractor (FastAPI)

Small standalone FastAPI service that calls Google Gemini (via `google-genai`) to extract strict JSON from invoice images.

Setup

1. Create a virtual environment and install dependencies:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r invoice_extractor/requirements.txt
```

2. Set your API key as an environment variable (DO NOT commit keys).

```powershell
setx GEMINI_API_KEY "your_api_key_here"
# or in the current session
$env:GEMINI_API_KEY = "your_api_key_here"
```

3. Run the service:

```powershell
uvicorn invoice_extractor.app:app --reload --port 8001
```

Security note

- The repository previously contained an API key in a prompt. That key must be rotated immediately — do not reuse it. Always store secrets in environment variables or a secrets manager.

Integration

- The endpoint `POST /api/v1/extract-invoice/` accepts a single file upload and returns structured JSON matching the Pydantic `InvoiceExtraction` schema. Use Django or any other backend to call this service and persist results.

Quick helper

To avoid typing the API key directly into shell history, there's a small PowerShell helper that prompts securely and sets `GEMINI_API_KEY` in the current PowerShell session:

```powershell
# Prompt for key (recommended)
.\set_gemini_key.ps1

# Or pass as argument (NOT recommended - may be saved in history)
.\set_gemini_key.ps1 -Key "your_api_key_here"
```

Remember: `set_gemini_key.ps1` sets the environment variable for the current session only. To persist across sessions, use `setx` (but avoid committing keys to files).
