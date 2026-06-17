# ResumeAI Backend

## Running the Server

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Requires Python dependencies from your environment; set `OPENAI_API_KEY` and MongoDB connection as in `config.py` / `.env`.

## Project Structure

### Code Organization

- `server.py` — Entrypoint: uvicorn loads `app:app`
- `app.py` — FastAPI app, CORS, `/api` router
- `config.py` — Environment, paths, `get_api_key()`, lazy `get_db()`
- `schemas.py` — Pydantic models (API contracts)
- `prompt_loader.py` — Load/cache prompts from subdirectories of `resources/prompts/`
- `llm.py` — OpenAI **Responses** API (`responses.create`), model aliases, text/JSON extraction
- `pdf.py` — PDF text extraction (PyPDF2)
- `storage.py` — MongoDB (insert, find, list, delete, patch `resume_json`)

### Services (`services/`)

- `format.py` — `format_resume_json()`, `format_jd_json()`
- `normalization.py` — `SkillNormalizer` (deterministic skills)
- `ats_scoring.py` — `compute_ats_score()` — six scoring phases + risk multiplier
- `evaluation.py` — `evaluate_with_loop()`, `load_basics()`, ATS/improve/hireability helpers
- `latex.py` — `generate_latex()`
- `cover_letter.py` — `generate_cover_letter()` (optional, post-evaluation)
- `cold_message.py` — `generate_cold_message()` (optional, post-evaluation)

### Prompts (`resources/prompts/`)

- **`format/`** — Resume/JD structuring and JSON update prompts
- **`improve/`** — `improve_system_*.txt` (standard / star / metrics-heavy), `improve_user.txt`
- **`latex/`** — LaTeX fill prompts
- **`review/`** — ATS gap analysis and HR/hireability prompts
- **`coverletter/`** — Cover letter generation
- **`coldmessage/`** — LinkedIn-style cold message
- **`misc/`** — Reference or experimental prompts

### Other resources

- **`resources/normalization/alias_map.json`** — Skill alias dictionary
- **`resources/basics.json`** — Contact block merged into final resume; cold message reads candidate name
- **`resources/templates/`** — LaTeX header/body/footer templates

## System Flow Overview

1. User submits resume (text or PDF).
2. **Parallel:** `format_resume_json`, `format_jd_json`, **`load_basics()`** (three tasks via `asyncio.gather`).
3. **Normalize** skills with `SkillNormalizer.normalize_pair`.
4. **Loop (default max 3):** LLM gap analysis → **`compute_ats_score`** (deterministic).
5. If **ATS ≥ 80** or **no iterations left:** **`get_hireability_analysis`**, then **`_build_result`** (injects basics into `resume_json`).
6. If **ATS < 80** and **iterations remain:** generate contextual role-alignment guidance from raw resume/JD text, then targeted **`get_improvement_suggestions`** (using per-phase score reasons + contextual guidance) → **apply** changes → re-normalize → repeat from step 4.
7. **Persist** full `EvaluationResult` in MongoDB; return JSON (`_id` stripped).
8. **Later (optional):** LaTeX (`GET`/`POST` …`/latex`), cover letter (`POST` …`/cover-letter`), cold message (`POST` …`/cold-message`) — separate requests, do not re-run the main pipeline.

## LaTeX Generation

- **`GET /api/evaluate/{id}/latex`** — Uses stored `resume_json`.
- **`POST /api/evaluate/{id}/latex`** — Body `{ "resume_json": { ... } }` for edited JSON without saving first.

## API Endpoints

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/api/` | Root |
| GET | `/api/health` | Health |
| POST | `/api/evaluate/text` | Evaluate text resume |
| POST | `/api/evaluate/pdf` | Evaluate PDF resume |
| GET | `/api/evaluate/{id}/latex` | LaTeX from stored evaluation |
| POST | `/api/evaluate/{id}/latex` | LaTeX from request body |
| POST | `/api/evaluate/{id}/cover-letter` | Generate cover letter JSON |
| POST | `/api/evaluate/{id}/cold-message` | Generate cold message JSON |
| GET | `/api/history` | Last 50 evaluations (summary) |
| GET | `/api/evaluation/{id}` | One evaluation |
| PATCH | `/api/evaluation/{id}/resume_json` | Update stored resume JSON |
| DELETE | `/api/evaluation/{id}` | Delete evaluation |

## Request/Response Examples

### Evaluate Text Resume

`POST /api/evaluate/text`

```json
{
  "resume_text": "John Doe\nSoftware Engineer...",
  "job_description": "We are looking for...",
  "target_role": "Software Engineer",
  "formatting_preference": "standard"
}
```

### Get LaTeX Code

`GET /api/evaluate/{evaluation_id}/latex`

```json
{
  "evaluation_id": "uuid",
  "latex_code": "\\documentclass..."
}
```

### Generate LaTeX from Edited JSON

`POST /api/evaluate/{evaluation_id}/latex`

```json
{
  "resume_json": { "resume": { } }
}
```

### Update Resume JSON

`PATCH /api/evaluation/{evaluation_id}/resume_json`

```json
{
  "resume_json": { "resume": { } }
}
```

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Layout, data flow, Mermaid diagrams, endpoint table
- **[docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)** — Full API reference
