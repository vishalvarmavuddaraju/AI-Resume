"""FastAPI app: CORS and router wiring."""
import os
import logging

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from config import get_db
from routes import api_router
from storage import ensure_indexes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

app = FastAPI()
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    db = get_db()
    await ensure_indexes(db)
