"""Isabelle reminder API.

The browser is the only client. It subscribes to push anonymously and, whenever
the app is open and the user is logged in to Mitt Friskis, syncs the user's
upcoming bookings here. The morning job (isabelle.remind) pushes a reminder for
every booking due that day. No Friskis credentials ever reach this server.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from isabelle import config, store

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

app = FastAPI(title="Isabelle reminders")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_BOOKINGS = 50


class Keys(BaseModel):
    p256dh: str
    auth: str


class Booking(BaseModel):
    id: int
    activity: str = Field(max_length=200)
    start: datetime
    location: str = Field(default="", max_length=200)
    instructor: str = Field(default="", max_length=200)
    waiting: bool = False

    @field_validator("start")
    @classmethod
    def to_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("start must carry a timezone")
        return value.astimezone(UTC)


class SyncIn(BaseModel):
    endpoint: str = Field(max_length=2000)
    keys: Keys
    bookings: list[Booking] = Field(default_factory=list, max_length=MAX_BOOKINGS)


class EndpointIn(BaseModel):
    endpoint: str = Field(max_length=2000)


def configured() -> bool:
    return bool(config.VAPID_PRIVATE and config.VAPID_PUBLIC)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/push/key")
def public_key() -> dict[str, str | None]:
    return {"key": config.VAPID_PUBLIC or None}


@app.put("/api/subscriptions")
def sync(body: SyncIn) -> dict[str, int]:
    if not configured():
        raise HTTPException(status_code=503, detail="push is not configured")
    rows = [
        {
            "id": b.id,
            "activity": b.activity,
            "start": b.start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "location": b.location,
            "instructor": b.instructor,
            "waiting": b.waiting,
        }
        for b in body.bookings
    ]
    with store.connect() as conn:
        store.upsert_subscription(conn, body.endpoint, body.keys.p256dh, body.keys.auth)
        store.replace_bookings(conn, body.endpoint, rows)
    return {"bookings": len(rows)}


@app.delete("/api/subscriptions")
def unsubscribe(body: EndpointIn) -> dict[str, bool]:
    with store.connect() as conn:
        store.delete_subscription(conn, body.endpoint)
    return {"subscribed": False}
