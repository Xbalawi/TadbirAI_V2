# FawatirAI Enterprise ERP Backend

A robust, comprehensive, and scalable backend system built with **Django** and **Django REST Framework (DRF)**. This backend powers an enterprise-grade ERP platform comprising **58 database models** structured across **10 core business modules**.

---

## 🚀 Key Features & Modules

The system is modularly architected to handle full-scale business operations across 10 functional domains:

1. **Foundation Module (14 tables)**: Core multi-tenancy/company setup, RBAC (Roles, Permissions, RolePermissions), Users, Preferences, Sessions, Security (Password Resets, Email Verifications), System Logs (Activity, Audit), Notifications, and PDF Templates.
2. **CRM Module (11 tables)**: Client & Supplier relationship management, Contacts, Addresses, Customer Portals, WhatsApp Integration, Marketing Campaigns, Ads, and Performance Metrics.
3. **Inventory Module (6 tables)**: Categories, Products, Variants, Stock Tracking, Movements, and Supplier-Product mappings.
4. **Accounting Module (7 tables)**: Invoicing, Invoice Items, Payments, Bank Accounts, Recurring Invoices, Bank Transactions, and Bank Reconciliations.
5. **Quotations Module (2 tables)**: Quotations and Quotation Items.
6. **Purchase Orders Module (2 tables)**: Purchase Orders and Purchase Order Items.
7. **POS (Point of Sale) Module (3 tables)**: POS Sessions, Sales, and Sale Items.
8. **Human Resources Module (4 tables)**: Departments, Employees, Payrolls, and Payroll Items.
9. **AI Module (8 tables)**: AI Conversations, Messages, Tasks, Recommendations, Automations, Notifications, Ad Generations, and OCR Document Processing.
10. **Support Module (1 table)**: Ticketing system for customer support.

---

## 📂 File Architecture

To keep our development clean and organized, here is the breakdown of the core backend structure:

```text
fawatir_backend/               
├── manage.py                  
├── fawatir_backend/           # Master Configuration Folder (settings.py, urls.py)
└── api/                       # Core API Application Folder
    ├── models.py              # Database Schema (MCD translated to Python)
    ├── serializers.py         # JSON API Contracts 
    ├── views.py               # Backend logic (CRUD)
    └── urls.py                # API Endpoint routes

The OCR pipeline is **100% free and local** — no paid API key required. It needs two things
installed outside of `pip`:

1. **Tesseract OCR** (Windows): `winget install --id UB-Mannheim.TesseractOCR -e`. The installer
   only ships the `eng` language pack — download `ara.traineddata` and `fra.traineddata` from
   [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) into a writable folder (e.g.
   `fawatir-backend/tessdata_local/`, gitignored) alongside a copy of `eng.traineddata` and
   `osd.traineddata` from the Tesseract install dir — `TESSDATA_PREFIX` is pointed at this folder
   via the `TESSDATA_DIR` env var, since the default `Program Files` install location usually
   isn't writable without admin rights.
2. **Ollama**, already running locally, with the model pulled: `ollama pull qwen2.5:3b-instruct`
   (a small multilingual model chosen to fit modest RAM/CPU-only machines).

```bash
pip install -r requirements.txt
cp .env.example .env   # defaults already point at qwen2.5:3b-instruct + local tessdata
python manage.py migrate
```

### Endpoints

- `POST /api/ai/documents/` — upload an invoice/receipt/shipping-doc image (`multipart/form-data`,
  fields: `company`, `file`; images only — jpg/png/webp, PDF not yet supported). Runs the free
  local pipeline: **Tesseract** (Latin and Arabic scripts OCR'd as separate passes — mixing them
  in one pass makes Tesseract misread Latin letters as Arabic glyphs) extracts raw text, a
  deterministic label+number matcher grabs HT/TVA/TTC directly from the text where possible
  (more reliable than the LLM for "find the number next to this label"), then **Ollama**
  (`qwen2.5:3b-instruct`) classifies the document type (invoice/shipping/receipt/other) and fills
  in whatever the pattern matcher didn't find. Returns the `Document` with `extracted_data` (full
  payload, including type-specific fields like `montant_ht`/`montant_tva`/`lignes`),
  `field_confidence` (pattern match > LLM-filled > missing), and `needs_review` (true if any
  field is missing or the HT/TVA/TTC math doesn't add up). Takes roughly 30–90s per document on
  CPU-only hardware.
  - The fields every document type shares — `doc_type`, `langue`, `fournisseur`, `date`,
    `numero`, `montant_ttc` — are also promoted to real columns on `Document` (via
    `Document.promote_fields()`, called after extraction and after any correction), so the rest
    of the app can query/filter on them directly instead of reaching into `extracted_data` JSON.
    Type-specific fields (`montant_ht`, `montant_tva`, `lignes`) stay JSON-only since they don't
    apply to every doc type. This is the pattern to follow if/when this data needs to flow into
    Fati's `Invoice` model (or a future `ShippingRecord`/`PurchaseOrder`) — a small mapping
    function per target type, same idea as `promote_fields()`.
- `PATCH /api/ai/documents/{id}/` — human correction endpoint; body: `{"extracted_data": {...}}`.
  Marks `needs_review` false once corrected.
- `GET /api/ai/documents/` / `GET /api/ai/documents/{id}/` — list/retrieve.
- `POST /api/ai/forecast/` — body: `{"company_id": "...", "history": [{"date": "YYYY-MM-DD",
  "amount": 123.45}, ...], "horizon_days": 30}`. Fits Prophet on the submitted history and
  returns a forecast series with confidence interval, a moving-average baseline for comparison,
  and `"indicative_only": true`. No decision should be automated on this alone (see proposal
  section 7.2).

- `POST /api/ai/spreadsheets/` — upload a `.xlsx` file (`multipart/form-data`, fields: `company`,
  `file`). Reads the first sheet (`pandas` + `openpyxl`), sends the column headers + a few sample
  rows to Ollama, which (1) classifies the data (`data_type`: `products`/`suppliers`/`clients`/
  `other`, free text — no fixed target model exists for this yet, so nothing is forced into one)
  and (2) proposes a clean `field_name` + `label` for every column, regardless of what the source
  file called it. Returns the `SpreadsheetImport` with `status=mapped` and the proposed mapping —
  **no rows are imported yet**. If the model's response is malformed, falls back to a slugified
  version of the original headers rather than failing outright.
- `PATCH /api/ai/spreadsheets/{id}/` — human corrects the proposed `column_mapping` (e.g. fixes a
  column the model wrongly marked `field_name: null`, meaning "ignore"). Same human-in-the-loop
  principle as `Document`, just as an explicit required gate here rather than a confidence
  heuristic, since there's no arithmetic to cross-check a spreadsheet mapping against.
- `POST /api/ai/spreadsheets/{id}/confirm/` — re-parses the file, applies the (current)
  `column_mapping` to every row, and stores the result in `normalized_rows` — the full dataset,
  consistently keyed regardless of the source file's original column names. `status=confirmed`.
- `GET /api/ai/spreadsheets/` / `GET .../{id}/` — list/retrieve.

Deliberately **not** promoted into a real Django model — the data types this targets (products,
suppliers) don't have one yet (Fati's domain, not built). `normalized_rows` is the same
"flexible JSON now, promote later" layer as `Document.extracted_data`; once a real `Product`/
`Supplier` model exists, promoting into it follows the same pattern as `Document.promote_fields()`.

### `/scanner/` — phone + PC test page

A single-file HTML/CSS/JS page (`ai/templates/ai/scanner.html`) for trying the pipeline without
building a real frontend: take a photo (mobile camera capture) or upload a file, see it OCR'd and
structured into a table, and browse a history table of everything processed so far.

Run the server bound to your LAN so your phone can reach it (same WiFi network):

```bash
python manage.py runserver 0.0.0.0:8000
```

Then open `http://<your-PC's-LAN-IP>:8000/scanner/` on both your PC and phone browsers — both
hit the same Django server and SQLite database, so anything scanned on one device shows up in the
history table on the other. This is the free/local stand-in for "cloud sync": it only works while
both devices are on the same WiFi and the PC is running the server. `ALLOWED_HOSTS = ['*']` in
`settings.py` is what permits this — tighten it before any real deployment.

### `/import/` — Excel import test page

A second single-file test page (`ai/templates/ai/import.html`), same pattern as `/scanner/`:
upload a `.xlsx`, see the AI-proposed column mapping in an editable table (correct any column it
got wrong), confirm, and see the resulting normalized dataset rendered as an actual table.

### Known limitations

- **OCR/model quality**: Tesseract + a 3B local LLM will not match commercial OCR/vision-LLM
  accuracy — expect more misreads on stylized/handwritten Arabic, skewed photos, or low light.
  The pipeline is designed to flag uncertain extractions via `needs_review` rather than silently
  guess, but it won't catch everything.
- **PDF not supported yet** — images only in this pass; would need `pdf2image`/poppler.
- Runs in-process (no Celery queue yet) — fine at this scale; each upload blocks for the OCR+LLM
  duration.
- `forecast_cashflow` takes history directly from the caller rather than reading real
  invoice/payment data, since those models don't exist yet. Once they do, add a thin endpoint
  that pulls a company's payment history and forwards it to `forecast_cashflow` — the service
  function itself doesn't need to change.
- OCR corrections are stored but not yet fed into any retraining/fine-tuning loop.
- **Excel import**: first sheet only (no multi-sheet workbooks yet); the model can still mark a
  meaningful column `field_name: null` (seen in real testing on abbreviated French headers like
  "Réf."/"Fourn.") — the mandatory review-before-confirm step is what catches this, not the model
  itself. No dedup/update-vs-create logic yet (every confirmed import is a fresh dataset).
