"""Google OAuth and auth session routes."""
import asyncio
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Query

from auth import create_access_token, get_current_user
from config import get_db, get_google_oauth_config
from schemas import AuthMeResponse, AuthTokenResponse
from storage import upsert_user_from_google

router = APIRouter()


@router.get("/auth/google/login")
async def google_login_url():
    cfg = get_google_oauth_config()
    if not cfg["client_id"] or not cfg["redirect_uri"]:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    params = urlencode(
        {
            "client_id": cfg["client_id"],
            "redirect_uri": cfg["redirect_uri"],
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "consent",
        }
    )
    return {"url": f"https://accounts.google.com/o/oauth2/v2/auth?{params}"}


async def _exchange_google_code(code: str, cfg: dict) -> dict:
    def _do_exchange():
        token_res = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "redirect_uri": cfg["redirect_uri"],
                "grant_type": "authorization_code",
            },
            timeout=20,
        )
        token_res.raise_for_status()
        id_token = token_res.json().get("id_token")
        if not id_token:
            raise ValueError("Google token response missing id_token")
        user_res = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
            timeout=20,
        )
        user_res.raise_for_status()
        return user_res.json()

    return await asyncio.to_thread(_do_exchange)


@router.get("/auth/google/callback", response_model=AuthTokenResponse)
async def google_callback(code: str = Query(...)):
    cfg = get_google_oauth_config()
    if not cfg["client_id"] or not cfg["client_secret"] or not cfg["redirect_uri"]:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    try:
        google_user = await _exchange_google_code(code, cfg)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Google OAuth exchange failed") from exc
    email = google_user.get("email")
    name = google_user.get("name") or email
    audience = google_user.get("aud")
    email_verified = google_user.get("email_verified")
    if audience != cfg["client_id"]:
        raise HTTPException(status_code=400, detail="Invalid OAuth audience")
    if str(email_verified).lower() not in {"true", "1"}:
        raise HTTPException(status_code=400, detail="Google email is not verified")
    if not email:
        raise HTTPException(status_code=400, detail="Google profile missing email")
    db = get_db()
    user = await upsert_user_from_google(db, email=email, name=name)
    token = create_access_token(user_id=user["id"], email=user["email"], role=user["role"])
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/auth/me", response_model=AuthMeResponse)
async def auth_me(current_user=Depends(get_current_user)):
    return {"user": current_user}
