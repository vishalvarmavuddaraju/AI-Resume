# ResumeAI

ResumeAI is a full-stack application that evaluates software engineering resumes against job descriptions using a combination of LLM-powered analysis and deterministic scoring algorithms. It automatically identifies gaps, iteratively rewrites resume bullets to improve alignment, and produces a final hireability assessment.

## The Problem

Job seekers face two compounding challenges: (1) **Applicant Tracking Systems (ATS)** filter resumes by keyword matching before a human reads them, and (2) resumes that pass ATS may still lack the engineering signal hiring managers look for. ResumeAI addresses both by:

- **Scoring** resumes against structured job requirements with a deterministic, risk-weighted ATS score
- **Rewriting** bullets automatically to close identified gaps (up to 3 improvement iterations)
- **Evaluating** how a FAANG-caliber hiring manager would perceive the candidate (hireability analysis)
- **Exporting** a LaTeX-ready resume for further editing or compilation

## Who It’s For

- **Software engineers** preparing applications: upload a resume and job description, get an ATS score, targeted improvements, hireability assessment, and LaTeX output.
- **Repeat applicants**: review evaluation history, edit the structured resume JSON, and regenerate LaTeX without re-running the full pipeline.

## Features

- **Authentication & roles**: Google OAuth login, JWT bearer sessions, role-based access (`user` / `admin`).
- **User profiles**: Profile basics are persisted per user and required before running evaluations.
- **Per-user data isolation**: History and evaluation CRUD are scoped to the authenticated user.
- **Usage quotas**: Monthly evaluation limits are enforced per user (default 50/month).
- **Admin controls**: Admin APIs to list/manage users and inspect evaluation activity summaries.
- **Dual input**: Paste resume text or upload a PDF (text is extracted automatically).
- **Structured extraction**: Resume and job description are converted to structured JSON via LLM (skills, experience, projects, education, JD requirements).
- **Skill normalization**: Deterministic canonicalization (e.g. "ReactJS", "react.js" → "React") using a versioned alias map (~430 entries).
- **ATS scoring**: 6-phase weighted score (must-have skills, experience years, cloud, preferred skills, experience depth, education) with risk multipliers for severe gaps.
- **Iterative improvement**: If ATS &lt; 80%, the system suggests and applies bullet rewrites, then re-scores until the threshold or max iterations (3) is reached.
- **Hireability analysis**: LLM-based hiring-manager perspective with shortlist decision and signal strengths.
- **History**: List, view, and delete past evaluations; edit resume JSON and regenerate LaTeX from the same evaluation.
- **LaTeX export**: Download compilable LaTeX built from the structured resume (header + LLM-filled body + footer).

## Tech Stack

| Layer        | Technologies                                           |
| ------------ | ------------------------------------------------------ |
| **Frontend** | React 19, Tailwind CSS, shadcn/ui, Axios, React Router |
| **Backend**  | FastAPI, Python 3.x, Uvicorn                           |
| **LLM**      | OpenAI API (configurable “mini” / “ultra” model tiers) |
| **Data**     | MongoDB (async via Motor)                              |

## Getting Started

### Prerequisites

- Python 3.x (backend)
- Node.js and npm (frontend)
- MongoDB instance
- OpenAI API key

### Backend

1. Go to the backend directory and create a virtual environment:

   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate   # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Create a `.env` file in `backend/` (or set environment variables):

   ```env
   OPENAI_API_KEY=your_openai_api_key
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=resumeai
   JWT_SECRET=replace_me
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
   FRONTEND_URL=http://localhost:3000
   ```

   Optional: `OPENAI_MODEL`, `OPENAI_MODEL_MINI`, `OPENAI_MODEL_ULTRA` for model selection.

3. Start the API server:

   ```bash
   uvicorn server:app --reload --host 0.0.0.0 --port 8000
   ```

   API docs: `http://localhost:8000/docs`

### Frontend

1. From the project root:

   ```bash
   cd frontend
   npm install
   npm start
   ```

2. The app will open at `http://localhost:3000` (or the next available port). Ensure the backend is running on port 8000 so the frontend can call the API.

## Project Structure

```
resumeai/
├── backend/           # FastAPI app, services, prompts, storage
│   ├── services/      # format, normalization, ats_scoring, evaluation, latex
│   ├── routes/        # health, auth, user, admin, evaluate, history
│   ├── resources/
│   │   ├── prompts/   # format/, improve/, latex/, review/, misc/
│   │   ├── normalization/  # alias_map.json
│   │   └── templates/ # LaTeX templates
│   └── ...
├── frontend/          # React SPA (Evaluate, History, ResultsDashboard, etc.)
└── DESIGN_DOCUMENT.md # Full architecture, data flow, and design decisions
```

For detailed backend layout, API endpoints, and flow, see **[backend/README.md](backend/README.md)**.

## Documentation

- **[backend/README.md](backend/README.md)** — Backend structure, system flow, API reference, and LaTeX workflow.

## License

See repository for license information.
