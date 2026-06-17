"""Environment, paths, API key, and MongoDB client."""
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

_client: AsyncIOMotorClient | None = None
_db = None


def get_api_key() -> str | None:
    user_key = os.environ.get("OPENAI_API_KEY", "")
    if user_key and user_key.strip():
        return user_key.strip()
    return None


def get_ats_pass_threshold() -> int:
    """Minimum ATS score (0–100) to pass the optimization loop early. Default 70."""
    raw = os.environ.get("ATS_PASS_THRESHOLD", "70")
    try:
        v = int(str(raw).strip())
        if 0 <= v <= 100:
            return v
    except (ValueError, TypeError):
        pass
    return 70


def get_db():
    """Return the MongoDB database instance. Lazy-init on first use."""
    global _client, _db
    if _db is None:
        mongo_url = os.environ["MONGO_URL"]
        _client = AsyncIOMotorClient(mongo_url)
        _db = _client[os.environ["DB_NAME"]]
    return _db


def get_google_oauth_config() -> dict:
    return {
        "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
        "redirect_uri": os.environ.get("GOOGLE_REDIRECT_URI", ""),
        "frontend_url": os.environ.get("FRONTEND_URL", "http://localhost:3000"),
    }
