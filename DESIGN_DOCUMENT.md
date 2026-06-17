# ResumeAI - Engineering Design Document

**Document Version:** 1.1
**Date:** March 28, 2026
**Author:** Staff Engineering Review

---

## 1. Executive Summary

### What It Is

ResumeAI is a full-stack application that evaluates software engineering resumes against job descriptions using a combination of LLM-powered analysis and deterministic scoring algorithms. It automatically identifies gaps, iteratively rewrites resume bullets to improve alignment, and produces a final hireability assessment.

### Core Problem

Job seekers face two distinct but compounding challenges: (1) Applicant Tracking Systems (ATS) filter resumes based on keyword matching before a human ever reads them, and (2) even resumes that pass ATS screening may lack the engineering signal that hiring managers look for. ResumeAI addresses both by scoring resumes against structured job requirements and automatically rewriting bullets to close identified gaps, while separately evaluating how a FAANG-caliber hiring manager would perceive the candidate.

### Primary Users and Use Cases

- **Software engineers** preparing applications for specific roles: upload a resume and job description, receive an ATS score, targeted improvements, hireability assessment, LaTeX export, and optional LLM-generated cover letter PDF and LinkedIn cold message text.
- **Repeat applicants** reviewing evaluation history: compare past evaluations, manually edit the structured resume JSON, and regenerate LaTeX without re-running the full pipeline.

---

## 2. System Architecture (High-Level Design)

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React SPA)                         │
│  React 19 · Tailwind CSS · shadcn/ui · Axios · React Router         │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │
│  │ EvaluatePage  │  │ HistoryPage  │  │ ResultsDashboard (shared)  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬───────────────┘  │
│         │                 │                        │                  │
└─────────┼─────────────────┼────────────────────────┼─────────────────┘
          │  HTTP/JSON      │  HTTP/JSON              │  HTTP/JSON
          ▼                 ▼                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI, mount: /api)                   │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  ┌────────┐ │
│  │ /health  │  │ /auth/*       │  │ /evaluate, /history  │  │ /admin │ │
│  │ /        │  │ /user/profile │  │ /evaluation/*, /latex │  │  /*    │ │
│  └──────────┘  └──────┬───────┘  └───────────┬───────────┘  └────┬───┘ │
│                       │                   │                          │
│              ┌────────▼──────────────────────────────────┐           │
│              │          SERVICE LAYER                     │           │
│              │                                           │           │
│              │  ┌──────────────────────────────────────┐ │           │
│              │  │        evaluation.py                  │ │           │
│              │  │   (Orchestrator / Improvement Loop)   │ │           │
│              │  └─────┬──────┬──────┬──────┬───────────┘ │           │
│              │        │      │      │      │             │           │
│              │   ┌────▼──┐ ┌─▼───┐ ┌▼────┐ ┌▼─────────┐ │           │
│              │   │format │ │norm.│ │ats  │ │   latex   │ │           │
│              │   │  .py  │ │ .py │ │score│ │    .py    │ │           │
│              │   └───────┘ └─────┘ └─────┘ └──────────┘  │           │
│              └───────────────────────────────────────────┘           │
│                       │              │                               │
│              ┌────────▼──┐    ┌──────▼──────┐                        │
│              │ OpenAI API│    │ Prompt Loader│                        │
│              │  (llm.py) │    │& Templates   │                        │
│              └───────────┘    └──────────────┘                        │
│                       │                                              │
│              ┌────────▼──────────┐                                   │
│              │  MongoDB (Motor)  │                                   │
│              │   storage.py      │                                   │
│              └───────────────────┘                                   │
└──────────────────────────────────────────────────────────────────────┘
```

### Major Components and Responsibilities


| Component                   | Responsibility                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Frontend SPA**            | User input (text/PDF), settings configuration, results visualization, JSON editing, LaTeX export, history browsing |
| **API Layer (`routes/`)**   | HTTP endpoints under `/api`: health, auth, user profile, evaluate, history/evaluation CRUD, and admin management    |
| **Auth Layer (`auth.py`)**  | JWT creation/validation, bearer auth dependency, and admin-role gate                                                 |
| **Evaluation Orchestrator** | End-to-end pipeline coordination: format → normalize → score → improve → re-score → HR analysis                    |
| **Format Service**          | LLM-powered conversion of unstructured text to structured JSON (both resume and JD)                                |
| **Normalization Engine**    | Deterministic skill canonicalization using alias maps and structural cleanup                                       |
| **ATS Scoring Engine**      | Deterministic, weighted multi-phase scoring with risk multipliers                                                  |
| **LaTeX Generator**         | LLM-powered template population from structured resume JSON                                                        |
| **Prompt System**           | File-based prompt templates with variable substitution and caching                                                 |
| **Data Layer**              | MongoDB persistence via async Motor driver                                                                         |
| **LLM Client**              | OpenAI Responses API (`responses.create`) with model aliases and response text extraction                          |
| **Cover / cold generators** | Optional post-evaluation LLM flows for cover letter JSON → client-side PDF and cold outreach message text          |


### Communication Between Components

All frontend-backend communication is over REST/JSON via Axios, with bearer-token auth for protected routes. All JSON routes are prefixed with `/api` (for example `POST /api/evaluate/text`, `GET /api/auth/me`, `GET /api/health`). The backend services are in-process Python modules — there are no inter-service network calls beyond the OpenAI API and Google OAuth endpoints. MongoDB access is async via the Motor driver. The system is monolithic in deployment but modular in code organization.

---

## 3. Core Workflow / Data Flow

### End-to-End Evaluation Flow

Protected evaluation entry points are `POST /api/evaluate/text` and `POST /api/evaluate/pdf` (multipart form). The entire pipeline executes within a single request lifecycle.

**Other `/api` endpoints (not part of the core evaluation pipeline):** auth bootstrap/session (`GET /api/auth/google/login`, `GET /api/auth/google/callback`, `GET /api/auth/me`), profile onboarding (`PUT /api/user/profile/basics`), history/evaluation CRUD, LaTeX, cover letter, cold message, admin user management and summaries, plus `GET /api/health` and `GET /api/`.

```
Step 1: INPUT INGESTION
  ├── Text mode: raw resume text from request body
  └── PDF mode: PyPDF2 extracts text from uploaded file

Step 2: PARALLEL STRUCTURING (asyncio.gather)
  ├── format_resume_json()  → LLM converts resume text → structured JSON
  └── format_jd_json()      → LLM converts JD text → structured JSON

Step 3: SKILL NORMALIZATION
  └── SkillNormalizer.normalize_pair() → Canonicalizes skills in both
      JD and resume JSONs using alias map + structural cleanup

Step 4: ITERATIVE IMPROVEMENT LOOP (max 3 iterations)
  │
  ├── 4a: ATS GAP ANALYSIS
  │   └── LLM compares normalized resume vs JD → gap analysis JSON
  │
  ├── 4b: DETERMINISTIC SCORING
  │   └── compute_ats_score() → 6-phase weighted score with risk multipliers
  │
  ├── 4c: THRESHOLD CHECK
  │   ├── Score ≥ 80 → EXIT LOOP → proceed to Step 5
  │   └── Score < 80 AND not last iteration → continue to 4d
  │
  ├── 4d: CONTEXTUAL ALIGNMENT GUIDANCE
  │   └── LLM compares raw resume text and raw JD text to produce
  │      role-positioning guidance (3-4 sentence strategy + mismatches)
  │
  ├── 4e: IMPROVEMENT SUGGESTIONS
  │   └── LLM generates bullet rewrites using ATS reasons + contextual guidance
  │
  ├── 4f: APPLY IMPROVEMENTS
  │   └── LLM applies improvement_summary to resume JSON
  │
  └── 4g: RE-NORMALIZE → Loop back to 4a

Step 5: HIREABILITY ANALYSIS
  └── LLM evaluates resume from hiring manager perspective
      → hireability_score, signal strengths, shortlist decision

Step 6: RESULT ASSEMBLY & PERSISTENCE
  ├── _build_result() assembles all artifacts
  ├── Authenticated user's profile basics injected into resume JSON
  ├── EvaluationResult model constructed
  └── MongoDB insert via insert_evaluation() with user_id

Step 7: RESPONSE
  └── Full evaluation document returned to frontend
```

### LaTeX Generation Flow (Separate Request)

```
GET /api/evaluate/{id}/latex
  → Load evaluation from DB
  → Serialize evaluation.resume_json.resume to JSON string
  → LLM fills LaTeX template with resume content
  → Prepend header.tex + append footer.tex
  → Return { evaluation_id, latex_code }

POST /api/evaluate/{id}/latex  (body: { "resume_json": { ... } })
  → Same as GET but uses body.resume_json (supports edited JSON without persisting first)
  → Return { evaluation_id, latex_code }
```

---

## 4. Detailed Component Design (Low-Level Design)

### 4.1 Evaluation Orchestrator

**Purpose:** Central pipeline coordinator. Manages the iterative score-improve-rescore loop and aggregates all analysis artifacts into a single result.

**Key File:** `backend/services/evaluation.py`

**Important Functions:**


| Function                                     | Purpose                                                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `evaluate_with_loop()`                       | Main pipeline. Runs format → normalize → (score → improve → re-normalize)×N → HR analysis. Returns full result dict. |
| `get_improvement_suggestions()`              | Calls LLM with improve system/user prompts. Returns structured improvement summary.                                  |
| `get_contextual_alignment_guidance()`        | Calls LLM to infer semantic role alignment between raw resume and JD text.                                           |
| `apply_improvement_summary_to_resume_json()` | Calls LLM to apply original→improved text replacements to resume JSON.                                               |
| `get_ats_analysis()`                         | Calls LLM with normalized JD + resume. Returns structured gap analysis.                                              |
| `get_hireability_analysis()`                 | Calls LLM to evaluate resume from HR perspective. Returns hireability score + signals.                               |
| `_build_result()`                            | Assembles final result dict, injects user basics, extracts final verdict.                                            |


**Internal Logic:**

The improvement loop tracks `pending_improvements` across iterations. When an improvement round runs, the issues identified are stored and attached to the next iteration record, creating a traceable audit trail of what was changed between scoring rounds. The loop extracts `score_breakdown` reason strings for phases where the normalized weight is non-zero and the phase score is below 1.0 — covering **must-have, experience years, cloud, preferred, experience depth, and education** — and passes that map as `ats_score_reasons` to the improvement LLM. This focuses the LLM on actual gaps rather than asking for generic improvements.

`evaluate_with_loop(..., max_iterations: int = 3)` defaults to three iterations; the loop exits early when `ats_score >= 80`.

The `_build_result()` helper performs a specific data surgery: it replaces `resume_json.resume.basics` with the loaded basics (name, phone, email, links), ensuring the final output always has correct contact information regardless of what the LLM extracted.

**Interactions:** Calls `format.py`, `normalization.py`, `ats_scoring.py` directly. Calls `llm.py` for all OpenAI interactions. Does not interact with storage directly (that happens at the route level).

---

### 4.2 Format Service

**Purpose:** Converts unstructured text (resume and job description) into deterministic, structured JSON using LLM prompts with strict schemas.

**Key File:** `backend/services/format.py`

**Important Functions:**


| Function               | Purpose                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `format_resume_json()` | Resume text → structured JSON with sections for skills, experience, projects, publications, education               |
| `format_jd_json()`     | JD text → structured JSON with role metadata, technical requirements (must-have/preferred), experience expectations |


**Internal Logic:**

Both functions follow the same pattern: load system prompt → format user prompt with input → call LLM → parse JSON from response. Resume formatting uses the "mini" model for cost efficiency since the schema is well-defined. JD formatting uses the "ultra" model because correctly classifying must-have vs. preferred skills requires stronger reasoning.

The system prompts are highly prescriptive, including exact output schemas, field-level rules for date normalization, bullet cleanup, and skill classification. This is a deliberate design choice: by over-constraining the LLM's output format, the system reduces variance and makes downstream processing more reliable.

**Output Schemas:**

Resume JSON structure:

```
{ resume: { sections: { technical_skills, experience, projects, publications, education } } }
```

JD JSON structure:

```
{ role_metadata, technical_requirements: { must_have, preferred }, experience_expectations, raw_extracted_keywords }
```

---

### 4.3 Skill Normalization Engine

**Purpose:** Deterministic canonicalization of skill strings so that equivalent representations (e.g., "ReactJS", "react.js", "React") resolve to the same token before matching.

**Key File:** `backend/services/normalization.py`

**Key Class:** `SkillNormalizer`

**Pipeline Stages:**


| Stage         | Operation                                                                  | Example                         |
| ------------- | -------------------------------------------------------------------------- | ------------------------------- |
| 1. Structural | Whitespace collapse, slash standardization, punctuation cleanup, lowercase | `" React.js , "` → `"react.js"` |
| 2. Alias      | Controlled dictionary lookup from `alias_map.json`                         | `"react.js"` → `"React"`        |
| 3. Display    | If no alias match, preserve original casing with structural cleanup        | `"GraphQL"` stays `"GraphQL"`   |


**Important Methods:**


| Method                      | Purpose                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `normalize_skill()`         | Full 3-stage pipeline on a single skill string              |
| `normalize_skill_list()`    | Normalizes and deduplicates a list of skills                |
| `normalize_structured_jd()` | Processes all skill arrays in a structured JD JSON          |
| `normalize_resume_skills()` | Processes all skill categories in a structured resume JSON  |
| `normalize_pair()`          | Convenience method to normalize both JD and resume together |


**Audit Trail:** `NormalizationLog` records every transformation (original → normalized → canonical) for debugging and transparency. The `changed_only()` method filters to entries where a transformation actually occurred.

**Alias Map:** The `alias_map.json` contains ~430 entries covering programming languages, cloud platforms, frameworks, databases, DevOps tools, ML/AI concepts, and data engineering tools. It is versioned (currently v1.0) and validated at load time.

---

### 4.4 ATS Scoring Engine

**Purpose:** Computes a deterministic, risk-weighted ATS compatibility score from the gap analysis produced by the LLM. This is the only scoring component that does not involve LLM calls — it is pure algorithmic computation. `**ats_scoring.py` is the source of truth** (the module header references an internal scoring spec doc that may live alongside the repo).

**Key File:** `backend/services/ats_scoring.py`

**Key Function:** `compute_ats_score(gap_analysis) → dict`

**Scoring Phases (base weights before redistribution):**


| Phase                      | Base Weight | Score Calculation                                                                                                                                                                                            |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Must-have Skills (S_must)  | 35          | `CoreStrength = 1.0·(A/N) + 0.7·(B/N) − 0.3·(C/N)` where A/B/C are in-experience / skills-only / missing counts and **N** is `max(total_required, A+B+C)` so the denominator never undercounts listed skills |
| Experience Years (S_exp)   | 15          | If required years R=0: 1.0 if `meets_requirement` else 0.0; else `min(1.0, Y/R)`                                                                                                                             |
| Cloud Platform (S_cloud)   | 20          | Active only if JD requires a cloud string; then 1.0 if present in experience else 0.0; if not required, phase contributes 0 weight                                                                           |
| Preferred Skills (S_pref)  | 10          | `(pref_in_exp + 0.25·pref_skills_only) / total_preferred` (capped at 1.0), or 0 if no preferred skills                                                                                                       |
| Experience Depth (S_depth) | 10          | `matched / (matched + unmatched)` when JD lists expectations; else inactive (0 weight)                                                                                                                       |
| Education (S_edu)          | 10          | Active when `education_analysis.required_degree_level != "none"`; maps degree level / field match / satisfaction to 0.0–1.0 (including partial credit when degree level met but field mismatch)              |


**Dynamic Weight Normalization:** Phases are toggled on or off (must-haves present, cloud required, preferred listed, depth expectations listed, education required). Inactive phases drop out and remaining **base** weights are scaled so normalized weights sum to **100**.

**Risk Multiplier:** After the weighted raw score, a compound multiplier applies when **N > 5** for must-have–based rules (avoids over-penalizing tiny skill lists):

- Missing ratio >40%: ×0.6; >60%: ×0.4 (both can apply)
- Experience below 50% of required: ×0.5
- In-experience ratio <30% (among must-haves): ×0.5
- Skills-only-heavy (B > A): ×0.7

**Risk factor tags** (for transparency) include `education_requirement_not_met`, `required_cloud_not_in_experience`, and the must-have–ratio rules above.

**Output:** `final_score`, `raw_score`, `risk_multiplier`, `normalized_weights`, `phase_scores`, `score_breakdown` (per-phase score contribution + reason text), and `risk_factors`.

---

### 4.5 LaTeX Generator

**Purpose:** Produces a compilable LaTeX resume document from structured resume JSON.

**Key File:** `backend/services/latex.py`

**Internal Logic:**

The function uses a three-part template architecture:

1. `resume_template_header.tex` — LaTeX preamble, packages, formatting macros
2. LLM-generated body — the resume content populated into a template structure
3. `resume_template_footer.tex` — document closing

The LLM receives `resume_template.tex` (the body template) and the resume JSON, and fills in the content. The response is stripped of markdown code fences and sandwiched between the header and footer. This design ensures the preamble and closing are always syntactically correct regardless of LLM output quality.

Uses the "mini" model since template filling is a relatively straightforward task. Routes accept either stored evaluation resume JSON (`GET .../latex`) or a client-supplied `resume_json` body (`POST .../latex`) so edits can be previewed without a prior PATCH.

---

### 4.6 Prompt System

**Purpose:** Manages loading, caching, and variable substitution for all LLM prompt templates.

**Key File:** `backend/prompt_loader.py`

**Design:**

Prompts are stored as `.txt` files organized by domain:

```
resources/prompts/
├── format/        # Resume & JD structuring prompts
├── improve/       # Resume bullet rewriting prompts
├── latex/         # LaTeX template filling prompts
├── review/        # ATS gap analysis & HR evaluation prompts
├── coverletter/   # Cover letter generation
├── coldmessage/   # LinkedIn cold message generation
└── misc/          # Reference/experimental prompts
```

Each prompt pair consists of a system prompt (defining the LLM's role, rules, and output schema) and a user prompt (providing the specific inputs with `<<<VARIABLE>>>` placeholders).

The `format_prompt()` function supports both `{VAR_NAME}` (Python format) and `<<<VAR_NAME>>>` (custom delimiter) syntax for variable substitution.

An in-memory `_prompt_cache` dictionary avoids re-reading files on repeated calls. Each prompt getter function checks the cache before disk access.

---

### 4.7 LLM Client

**Purpose:** Abstracts OpenAI **Responses** API usage (`AsyncOpenAI().responses.create`), model selection, and response parsing.

**Key File:** `backend/llm.py`

**Primary entry points:** `responses_create()` / `responses_create_text()` — callers pass `instructions` (system prompt) and `input_text` (user payload). There is no separate Chat Completions path in current code.

**Model Selection Logic (`select_model`):**


| Alias          | Resolution                                                              |
| -------------- | ----------------------------------------------------------------------- |
| `"mini"`       | `OPENAI_MODEL_MINI` env var (cost-optimized)                            |
| `"ultra"`      | `OPENAI_MODEL_ULTRA` env var (quality-optimized)                        |
| `None` / empty | `OPENAI_MODEL`, falling back to `OPENAI_MODEL_MINI`, then `gpt-4o-mini` |
| Anything else  | Passed through as-is                                                    |


This three-tier model strategy allows the system to use cheaper models for mechanical tasks (formatting, JSON updates, LaTeX fill, cover letter) and more capable models for tasks requiring judgment (JD structuring, gap analysis, improvements, hireability).

**Response Handling:** `extract_response_text()` handles two response shapes — the direct `output_text` attribute and the chunked `output[].content[].text` format — for compatibility across SDK/API versions.

**JSON Parsing:** `parse_json_from_response_text()` strips a leading markdown fence block before `json.loads`, since models often wrap JSON in fences despite instructions not to.

---

### 4.8 Frontend SPA

**Purpose:** Single-page React application providing the user interface for evaluation, results visualization, and history management.

**Key File:** `frontend/src/App.js` (currently a large single file)

**Major UI Components:**


| Component           | Purpose                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `EvaluatePage`      | Input form (text/PDF toggle, JD input, role/formatting selectors), loading state, results view                         |
| `HistoryPage`       | List of past evaluations with detail view, delete functionality                                                        |
| `ResultsDashboard`  | Shared results visualization: score cards, ATS breakdown, skills gap, hireability, iteration timeline, highlight diffs |
| `ATSBreakdownPanel` | Per-phase ATS score visualization with progress bars and reason text                                                   |
| `SkillsGapPanel`    | Must-have/preferred skills categorized as found-in-experience, skills-only, or missing                                 |
| `ProfileSnapshot`   | Tabbed view of extracted resume data: skills, experience, projects, education                                          |
| `JsonEditorDialog`  | Modal for direct JSON editing of resume data with persistence to DB                                                    |
| `ScoreRing`         | SVG-based circular progress indicator for scores                                                                       |
| `LoadingCard`       | Multi-stage loading animation with pipeline step indicators                                                            |


**Key Frontend Logic:**

- **LaTeX Caching:** Uses `sessionStorage` with content-addressable keys (DJB2 hash of `stableStringify(resumeJson)`) to avoid redundant LaTeX generation API calls. Cache is invalidated when the resume JSON is edited.
- **Highlight Diffing:** Compares `initial_resume_json` vs. `resume_json` bullet-by-bullet across experience and projects sections, producing before/after diff cards. Links diffs to improvement issues via text matching against `improvements_summary`.
- **JSON Editor Persistence:** Edits made in the JSON editor are PATCH'd to the backend (`PATCH /api/evaluation/{id}/resume_json`), persisting them in MongoDB. This allows LaTeX generation from the edited version.
- **Cover letter:** Calls `POST /api/evaluate/{id}/cover-letter` with resume JSON + JD + optional company name; builds a PDF client-side with **jsPDF** from the structured JSON returned by the API.
- **Cold message:** Calls `POST /api/evaluate/{id}/cold-message` and shows the message in a dialog with copy-to-clipboard.

---

### 4.9 Cover Letter & Cold Message Services

**Purpose:** Optional, on-demand LLM generation after an evaluation exists. These do not mutate the stored evaluation document.

**Key Files:** `backend/services/cover_letter.py`, `backend/services/cold_message.py`

**Behavior:**

- **Cover letter:** `generate_cover_letter()` uses prompts under `resources/prompts/coverletter/`, model `"mini"`, returns parsed JSON consumed by the frontend to render sections into a PDF.
- **Cold message:** `generate_cold_message()` uses `resources/prompts/coldmessage/` and request payload context to generate structured content (e.g. `message_text`) for the UI.

**Routes:** `POST /api/evaluate/{evaluation_id}/cover-letter` and `POST /api/evaluate/{evaluation_id}/cold-message` require the evaluation to exist (404 if not); request bodies mirror `CoverLetterRequest` / `ColdMessageRequest` in `schemas.py`.

---

### 4.10 Data Layer

**Purpose:** Async MongoDB operations for evaluations, users, quotas, and admin summaries.

**Key File:** `backend/storage.py`

**Operations:**


| Function                          | Operation  | Notes                                                                 |
| --------------------------------- | ---------- | --------------------------------------------------------------------- |
| `insert_evaluation()`             | Insert     | Stores full evaluation document                                       |
| `find_evaluation()`               | Find one   | User-scoped by `(id, user_id)` and excludes `_id`                     |
| `list_evaluations()`              | Find many  | User-scoped summary projection, sorted by timestamp DESC, limit 50     |
| `delete_evaluation()`             | Delete one | User-scoped delete by `(id, user_id)`                                 |
| `update_evaluation_resume_json()` | Update one | User-scoped `$set` update to `resume_json`                            |
| `upsert_user_from_google()`       | Upsert     | Creates/updates user record from OAuth profile                        |
| `get_user_current_usage()`        | Aggregate  | Per-user day/week/month evaluation counts                             |
| `get_admin_evaluation_counts()`   | Aggregate  | Admin summary of per-user counts by period                            |


**Connection Management:** Lazy initialization in `config.py` — the MongoDB client is created on first `get_db()` call and reused thereafter. Uses `motor.motor_asyncio.AsyncIOMotorClient` for non-blocking I/O.

---

## 5. Algorithms & Key Logic

### 5.1 ATS Scoring Algorithm

The ATS scoring engine is the system's most carefully designed algorithmic component. It was built to model the behavior of real ATS systems at top-tier companies.

**Algorithm Steps:**

1. **Extract inputs** from gap analysis: must-have counts (A=in-experience, B=skills-only, C=missing, N=max(total_required, A+B+C)), experience years (R=required, Y=candidate), cloud requirement, preferred skills, experience depth expectations, and **education_analysis** (required vs candidate degree level, field match, satisfaction).
2. **Compute phase scores** (each S_i ∈ [0,1]):
  - Must-have: `CoreStrength = 1.0·(A/N) + 0.7·(B/N) − 0.3·(C/N)`, clamped to [0,1]. The 0.7 weight for skills-only reflects the reality that listing a skill without demonstrating it in experience is worth less but not worthless. The 0.3 penalty for missing skills is moderate because missing one skill out of many shouldn't tank the score.
  - Experience: If R=0, binary on `meets_requirement`; else `min(1.0, Y/R)`.
  - Cloud: Binary when a cloud is required; inactive (zero weight) when not.
  - Preferred: `(pref_exp + 0.25·pref_skills_only) / total_preferred` — preferred skills listed without experience demonstration count for only 25%.
  - Depth: `matched / (matched + unmatched)` when expectations exist.
  - Education: Piecewise score from degree level / field / requirement satisfaction when the JD specifies a degree requirement.
3. **Normalize weights** dynamically: Only active phases contribute. Base weights **35 / 15 / 20 / 10 / 10 / 10** (must / exp / cloud / pref / depth / edu) are redistributed among active phases to sum to 100.
4. **Compute raw score**: `Σ(W_i_normalized × S_i)`.
5. **Apply risk multiplier**: Compound penalties when N>5 for must-have ratios (missing >40%, >60%), experience <50%, in-experience ratio <30%, skills-only-heavy, etc.
6. **Final score**: `round(clamp(raw × multiplier, 0, 100))`.

**Design Rationale:** The two-stage approach (raw score + risk multiplier) allows the system to produce reasonable scores for well-matched candidates while sharply penalizing severe mismatches. A purely linear scoring model would give 60% to a candidate missing half the required skills, which is unrealistically generous. The risk multiplier corrects this.

### 5.2 Skill Normalization Pipeline

**Algorithm Steps:**

1. **Structural normalize**: strip → collapse whitespace → standardize slashes → remove trailing punctuation → lowercase.
2. **Alias lookup**: exact match against the canonical alias dictionary. If found, return the canonical display form.
3. **Display preservation**: If no alias match, return the structurally cleaned version of the original (preserving original casing like "GraphQL" rather than returning the lowercased form).

**Deduplication:** `normalize_skill_list()` uses a lowercase key set to eliminate duplicates that normalize to the same canonical form while preserving first-occurrence ordering.

**Why this approach:** The pipeline is intentionally *not* using fuzzy matching or embeddings-based similarity. Deterministic alias lookup ensures reproducibility — the same input always produces the same output. This is critical because the ATS scoring engine downstream depends on exact string matching between normalized JD skills and normalized resume skills.

### 5.3 Iterative Improvement Loop

**Algorithm:**

```
for iteration in 1..max_iterations:   # default max_iterations = 3
    gap_analysis = LLM_analyze(normalized_jd, normalized_resume)
    ats_score = deterministic_score(gap_analysis)

    if ats_score >= 80:
        break  // target reached

    if iteration < max_iterations:
        // Reasons for phases with normalized weight > 0 and phase score < 1.0
        // (must_have, experience_years, cloud, preferred, experience_depth, education)
        improvements = LLM_suggest(resume, jd, ats_score_reasons)
        resume = LLM_apply(resume, improvements)
        normalize(resume)  // re-canonicalize after edits
```

**Design Rationale:** The 80% threshold was chosen as a "strong match" cutoff. The default max of three iterations bounds cost (each iteration involves up to three LLM calls: analyze, suggest, apply). The targeted phase feedback prevents the improvement LLM from making scattershot changes — it receives specific reasons for score deductions.

---

## 6. Data Models & Structures

### 6.1 API Request/Response Models (Pydantic)

`**EvaluationRequest`:**

```python
resume_text: str
job_description: str
target_role: str = "Software Engineer"
formatting_preference: str = "standard"  # standard | star | metrics-heavy
```

**Supporting request models** (see `backend/schemas.py`): `LatexFromJsonRequest` (`resume_json`), `UpdateResumeJsonRequest` (`resume_json`), `CoverLetterRequest` / `ColdMessageRequest` (`resume_json`, `job_description`, optional `company_name`, `target_role`).

`**EvaluationResult`:** The core domain object, stored in MongoDB as-is.

```python
id: str (UUID)
timestamp: str (ISO 8601)
original_resume_text: str          # Raw input for reference
initial_resume_json: dict          # Before any improvements
resume_json: dict                  # After improvements + basics injection
jd_json: dict                     # Structured JD
job_description: str              # Raw JD text
target_role: str
formatting_preference: str
ats_analysis: dict                # LLM gap analysis output
ats_result: dict                  # Deterministic scoring output
final_verdict: dict               # Shortlist decision + reason
hireability_analysis: dict | None # HR evaluation output
iterations: list[dict]            # Per-iteration ATS scores + changes
improvements_summary: list[dict]  # All improvement records across iterations
contextual_alignment_guidance: dict | None # semantic role-positioning guidance used by improvement step
```

`**HistoryItem`:** Lightweight projection for the history list view.

```python
id, timestamp, target_role, ats_score, hireability_score, interview_probability, preview
```

### 6.2 Resume JSON Schema

```json
{
  "resume": {
    "basics": {
      "name": "", "phone": "", "email": "",
      "links": [{ "label": "", "url": "" }]
    },
    "sections": {
      "technical_skills": {
        "categories": [{ "name": "", "items": [] }]
      },
      "experience": {
        "items": [{
          "title": "", "company": "", "location": "",
          "start_date": "", "end_date": "",
          "highlights": [], "tags": []
        }]
      },
      "projects": {
        "items": [{
          "name": "", "links": [], "tech_stack": [], "highlights": []
        }]
      },
      "publications": {
        "items": [{
          "title": "", "publisher_or_venue": "", "date": "",
          "topics": [], "link": ""
        }]
      },
      "education": {
        "items": [{
          "institution": "", "degree": "",
          "start_date": "", "end_date": "",
          "gpa": { "value": null, "scale": null },
          "coursework": []
        }]
      }
    }
  }
}
```

### 6.3 Job Description JSON Schema

```json
{
  "role_metadata": {
    "job_title": "",
    "minimum_years_experience": 0
  },
  "technical_requirements": {
    "must_have": {
      "programming_languages": [],
      "cloud_platforms": [],
      "frameworks_tools": [],
      "databases": []
    },
    "preferred": { /* same structure */ }
  },
  "experience_expectations": {
    "system_design_exposure": false,
    "data_modeling": false,
    "distributed_systems": false,
    "stakeholder_collaboration": false
  },
  "raw_extracted_keywords": []
}
```

### 6.4 ATS Gap Analysis Schema

```json
{
  "must_have_analysis": {
    "total_required": 0,
    "found_in_experience": [],
    "found_in_skills_only": [],
    "missing": []
  },
  "preferred_analysis": { /* same buckets */ },
  "experience_requirement": {
    "minimum_years_required": 0,
    "candidate_total_years": 0,
    "meets_requirement": true
  },
  "required_cloud_status": {
    "required": "",
    "present_in_experience": true
  },
  "experience_expectations_analysis": {
    "matched": [],
    "unmatched": []
  },
  "education_analysis": {
    "required_degree_level": "none",
    "candidate_degree_level": "none",
    "field_match": true,
    "requirement_satisfied": true
  },
  "hard_fail_flags": []
}
```

### 6.5 Database Schema

MongoDB collections: `evaluations`, `users`

Each evaluation document is the full `EvaluationResult` dict. The `id` field (UUID string) is used as the logical primary key (not MongoDB's `_id`). Evaluations are user-scoped via `user_id` and commonly queried by `id` + `user_id` or by `user_id` sorted by `timestamp`. User documents store auth/profile/quota/admin metadata.

---

## 7. Design Decisions & Tradeoffs

### 7.1 Hybrid LLM + Deterministic Architecture

**Decision:** Use LLMs for unstructured-to-structured conversion and qualitative analysis, but use deterministic algorithms for scoring.

**Rationale:** LLM-based scoring would be non-reproducible — the same resume could score differently on consecutive runs. By constraining the LLM to produce structured gap analysis and computing the score algorithmically, the system achieves deterministic, explainable scores. The LLM handles what it's good at (natural language understanding, classification) while the scoring math ensures consistency.

### 7.2 Three-Tier Model Strategy

**Decision:** Map tasks to model tiers — "mini" for mechanical tasks, "ultra" for judgment-heavy tasks.

**Rationale:** Resume formatting and JSON updates are schema-filling exercises that cheaper models handle well. JD classification (must-have vs. preferred), gap analysis, and improvement generation require stronger reasoning. This reduces cost per evaluation without sacrificing quality where it matters. The environment variable indirection (`OPENAI_MODEL_MINI`, `OPENAI_MODEL_ULTRA`) allows model upgrades without code changes.

### 7.3 Single-File Frontend

**Decision:** The frontend currently keeps most UI logic in a single large `App.js` file.

**Rationale:** This is a development speed tradeoff. For a personal project with a single developer, the overhead of a multi-file component architecture (separate files, barrel exports, shared state management library) exceeds the benefit. The logical sections are clearly demarcated with comment headers. However, this would not scale well for a team environment.

### 7.4 File-Based Prompt Management

**Decision:** Prompts are stored as `.txt` files rather than inline strings or a database.

**Rationale:** Separating prompts from code provides three benefits: (1) prompts can be reviewed and edited by non-engineers, (2) version control diffs are cleaner when prompts change, (3) the prompt_loader caching layer avoids repeated disk reads. The `<<<VAR>>>` delimiter convention avoids conflicts with Python's `{}`-based string formatting in prompts that contain JSON schemas.

### 7.5 Synchronous Pipeline (No Background Jobs)

**Decision:** The entire evaluation pipeline runs synchronously within a single HTTP request.

**Rationale:** The pipeline takes 30–60 seconds due to multiple sequential LLM calls. A background job architecture (Celery, Redis queue) would improve UX but adds significant infrastructure complexity. The frontend mitigates the wait with a multi-stage loading animation. For the current early-stage product, this remains acceptable; for higher concurrency, this is a first-order scaling change.

### 7.6 MongoDB for Persistence

**Decision:** Use MongoDB rather than a relational database.

**Rationale:** The evaluation documents are deeply nested JSON with variable shapes (different JDs produce different skill lists, different resumes have different section counts). MongoDB's schemaless nature matches this perfectly — no ORM mapping, no migration files, the Pydantic model dumps directly to BSON. The Motor async driver integrates cleanly with FastAPI's async handler model.

### 7.7 Lazy Database Initialization

**Decision:** The MongoDB client is created on first use via `get_db()` rather than at module import time.

**Rationale:** This avoids connection errors at import time when the database isn't reachable (e.g., during testing or when only the frontend is running). The global singleton pattern with `_client` and `_db` ensures only one connection pool exists.

---

## 8. Scalability Considerations

### 8.1 Current Bottlenecks

1. **Synchronous LLM calls in the critical path.** Each evaluation makes 5–10 OpenAI API calls (format×2, analyze, improve, apply, analyze again, HR analysis), each taking 2–15 seconds. The total pipeline time is dominated by sequential LLM latency.
2. **Single-threaded request handling under load.** While FastAPI/uvicorn handle concurrent requests via async I/O, the sequential LLM calls within each request consume wall-clock time and API rate limits.
3. **No request queuing.** Under concurrent load, all requests hit the OpenAI API simultaneously, risking rate limits. There is no backpressure mechanism.
4. **In-memory prompt caching.** The `_prompt_cache` dict is process-local. In a multi-worker deployment, each worker loads its own copy (acceptable for small files but architecturally fragile).
5. **MongoDB connection sharing.** The global `_client` singleton works for single-process but requires revisiting for multi-worker deployments (Motor handles this correctly via connection pooling, but the lazy init pattern with global state is not thread-safe for first-call races).

### 8.2 Behavior at Scale

- **10 concurrent users:** Would work but may hit OpenAI rate limits. Total evaluation time would increase due to API throttling.
- **100 concurrent users:** Would require queuing, rate limit management, and likely a background job architecture. The synchronous request model would cause timeouts.
- **High-volume history/admin queries:** User history is efficient due to scoped + limited queries, and startup now creates indexes (`evaluations(user_id, timestamp)`, `users(email)`). Additional admin/reporting indexes may be needed as data grows.

### 8.3 Scaling Improvements

1. **Background job queue** (Celery + Redis/RabbitMQ): Move the evaluation pipeline out of the HTTP request lifecycle. Return a job ID immediately, let the client poll for completion.
2. **LLM call parallelization:** The ATS analysis and improvement suggestions could potentially run in parallel with some pipeline restructuring.
3. **Caching layer:** Cache LLM responses for identical resume+JD combinations using content-addressable storage. The normalization layer ensures equivalent inputs produce identical cache keys.
4. **Database indexing:** Create compound indexes on `{timestamp: -1}` and `{id: 1}` for the evaluations collection.
5. **Horizontal scaling:** The stateless API layer can be deployed behind a load balancer with shared MongoDB. The prompt file system would need to be part of the container image or a shared volume.

---

## 9. Code Quality Evaluation

### 9.1 Strengths

1. **Clean separation of concerns.** The services layer is well-decomposed: format, normalize, score, improve, and LaTeX are independent modules with clear interfaces. The orchestrator (`evaluation.py`) coordinates them without leaking implementation details.
2. **Deterministic scoring engine.** The `compute_ats_score()` function is pure: no side effects, no external dependencies, fully testable in isolation. The two-stage scoring (raw + risk multiplier) is well-documented and produces explainable results.
3. **Robust normalization pipeline.** The `SkillNormalizer` class is well-structured with clear stage separation, audit logging, and a versioned alias map. The deduplication logic in `normalize_skill_list()` is correct and efficient.
4. **Thoughtful prompt engineering.** The prompts are precise, include exact output schemas, and use strict rules to constrain LLM behavior. The separation of system/user prompts follows best practices for reproducibility.
5. **Async-first backend.** Consistent use of `async/await` throughout the backend, with `asyncio.gather` for parallel operations where possible (format resume + format JD).
6. **Defensive response parsing.** The LLM client handles multiple response formats and gracefully strips markdown fences from JSON responses — a common real-world issue.

### 9.2 Potential Code Smells

1. **Monolithic frontend.** The large `App.js` contains many pages/components/handlers, which makes navigation and team parallelization harder.
2. **Limited automated test footprint.** The backend includes unit tests (`backend/tests/test_ats_score.py`, `test_normalization.py`, `test_prompt_loader.py`); coverage is not exhaustive across the full pipeline or frontend.
3. **Error handling inconsistency.** Some service functions raise `HTTPException` (coupling service logic to the web framework), while others return `None` on failure (hireability analysis). Services should raise domain exceptions that routes translate to HTTP errors.
4. **Hardcoded configuration.** The 80% ATS threshold and max 3 iterations live in `evaluation.py`; base phase weights and risk rules live in `ats_scoring.py` — not centralized in config or environment variables.
5. **Mixed `dict` and Pydantic usage.** The evaluation result is constructed as a Pydantic model in the route but flows through the service layer as plain dicts. This loses type safety at the boundary where it matters most.
6. **Service-layer HTTP exceptions.** Several service functions raise `HTTPException`, which couples domain logic to FastAPI transport concerns.

### 9.3 Refactoring Opportunities

1. **Extract frontend components** into separate files with a proper component hierarchy and shared state via React Context or Zustand.
2. **Introduce domain exceptions** (`ATSAnalysisError`, `LLMParseError`) in the service layer, caught and translated in the route layer.
3. **Centralize constants** (thresholds, weights, model aliases) into a configuration module or environment variables.
4. **Add type hints to dict-returning functions** using `TypedDict` to document expected shapes without full Pydantic overhead.
5. **Extract the improvement loop** into a separate class with pluggable strategies (e.g., different improvement approaches for different formatting preferences).

---

## 10. Future Improvements

### 10.1 Performance

- **Streaming responses:** Use Server-Sent Events (SSE) to stream pipeline progress to the frontend in real-time rather than relying on client-side timer-based stage indicators.
- **LLM response caching:** Cache format, analysis, and improvement responses using hashed inputs as keys. Avoid re-running the full pipeline when only the JD or resume changes slightly.
- **Parallel LLM calls within iterations:** After the first iteration, the improvement suggestion and the HR analysis could potentially run concurrently.

### 10.2 Architecture

- **Background job system:** Replace the synchronous pipeline with an async task queue. This enables retry logic, dead letter queues for failed evaluations, and eliminates HTTP timeout concerns.
- **Access control hardening:** Add token revocation/session invalidation, optional refresh-token rotation, and audit logs for admin actions.
- **Webhook/notification system:** Notify users when long-running evaluations complete rather than requiring them to keep the browser tab open.

### 10.3 Maintainability

- **Comprehensive test suite:** Extend existing backend unit tests (`test_ats_score.py`, `test_normalization.py`, `test_prompt_loader.py`) with edge cases (zero requirements, all missing, education mismatch) and add integration tests for the evaluation pipeline with mocked LLM responses and frontend coverage where valuable.
- **Frontend decomposition:** Break `App.js` into a proper component tree. Introduce a state management layer (React Context, Zustand, or Jotai) for shared evaluation state.
- **API documentation:** Generate OpenAPI docs automatically from FastAPI (already available at `/docs` but not customized). Add request/response examples.

### 10.4 Feature Extensions

- **Multiple formatting strategies:** Currently only "standard" has an implemented prompt. Add distinct prompts for "star" and "metrics-heavy" formatting preferences.
- **Side-by-side comparison:** Allow users to compare two evaluations for the same resume against different JDs, or the same JD with different resume versions.
- **PDF export:** Generate PDF output directly rather than requiring the user to copy LaTeX to Overleaf. Could use a LaTeX-to-PDF compilation service.
- **Batch evaluation:** Upload a resume once and evaluate against multiple JDs simultaneously.
- **Improvement diff viewer:** Enhance the frontend diff view with inline character-level diffs rather than full bullet before/after.
- **Alias map editor:** Allow users to add custom skill aliases (e.g., internal tool names) through the UI.
- **Score trend analytics:** Track ATS and hireability scores over time across evaluations to show improvement trends.

---

*End of Design Document*