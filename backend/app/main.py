"""
Hackmatrix API.

Two routers, two database connections, one per role. The separation between
them is a Postgres grant rather than a conditional — see app/db.py and
db/README.md.

Run:
    cd backend
    pip install -r requirements.txt
    cp .env.example .env     # then fill in both connection strings
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import admin_engine, clinician_engine, role_of
from .models import Health
from .routers import admin, auth, clinician

load_dotenv()

app = FastAPI(
    title="Hackmatrix API",
    version="0.1.0",
    description=(
        "Clinician routes read and append identified records. Administrator "
        "routes can only reach suppressed aggregates — not by convention, but "
        "because their database role holds no grant on the identified tables. "
        "GET /admin/prove demonstrates this."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if o.strip()
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],  # no PUT/PATCH/DELETE — records are append-only
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(clinician.router)
app.include_router(admin.router)


@app.get("/health", response_model=Health, tags=["meta"])
def health():
    """Reports which database role each connection is actually authenticated as,
    so the separation is inspectable at runtime rather than only documented."""
    try:
        return Health(
            status="ok",
            clinicianRole=role_of(clinician_engine()),
            adminRole=role_of(admin_engine()),
        )
    except Exception as exc:  # noqa: BLE001 — surfaced to the caller deliberately
        return Health(status="error", detail=str(exc).splitlines()[0])
