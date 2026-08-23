"""SQLite storage. One row per push subscription (the anonymous identity), and
the upcoming bookings the browser last synced for it. Nothing here can identify
a person: no Friskis credentials, no email, just a push endpoint and class
names with times."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager

from isabelle import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS subscriptions (
    endpoint TEXT PRIMARY KEY,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS bookings (
    endpoint TEXT NOT NULL REFERENCES subscriptions(endpoint) ON DELETE CASCADE,
    activity_id INTEGER NOT NULL,
    activity TEXT NOT NULL,
    start TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    instructor TEXT NOT NULL DEFAULT '',
    waiting INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (endpoint, activity_id)
);
CREATE TABLE IF NOT EXISTS reminders_sent (
    endpoint TEXT NOT NULL,
    activity_id INTEGER NOT NULL,
    sent_on TEXT NOT NULL,
    PRIMARY KEY (endpoint, activity_id)
);
"""


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        conn.executescript(SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


def upsert_subscription(conn: sqlite3.Connection, endpoint: str, p256dh: str, auth: str) -> None:
    conn.execute(
        """INSERT INTO subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)
           ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth,
           updated_at=datetime('now')""",
        (endpoint, p256dh, auth),
    )


def replace_bookings(conn: sqlite3.Connection, endpoint: str, bookings: list[dict]) -> None:
    conn.execute("DELETE FROM bookings WHERE endpoint = ?", (endpoint,))
    conn.executemany(
        """INSERT INTO bookings (endpoint, activity_id, activity, start, location, instructor, waiting)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        [
            (
                endpoint,
                b["id"],
                b["activity"],
                b["start"],
                b.get("location", ""),
                b.get("instructor", ""),
                1 if b.get("waiting") else 0,
            )
            for b in bookings
        ],
    )


def delete_subscription(conn: sqlite3.Connection, endpoint: str) -> None:
    conn.execute("DELETE FROM subscriptions WHERE endpoint = ?", (endpoint,))
    conn.execute("DELETE FROM reminders_sent WHERE endpoint = ?", (endpoint,))


def delete_subscriptions(conn: sqlite3.Connection, endpoints: list[str]) -> None:
    for endpoint in endpoints:
        delete_subscription(conn, endpoint)


def bookings_between(conn: sqlite3.Connection, start_iso: str, end_iso: str) -> list[sqlite3.Row]:
    """Bookings starting in [start, end) that have not been reminded about, with
    their subscription keys. ISO strings compare correctly as long as every
    stored `start` is UTC with the same format, which the API enforces."""
    return conn.execute(
        """SELECT b.endpoint, b.activity_id, b.activity, b.start, b.location, b.instructor,
                  b.waiting, s.p256dh, s.auth
           FROM bookings b JOIN subscriptions s ON s.endpoint = b.endpoint
           WHERE b.start >= ? AND b.start < ?
             AND NOT EXISTS (SELECT 1 FROM reminders_sent r
                             WHERE r.endpoint = b.endpoint AND r.activity_id = b.activity_id)
           ORDER BY b.start""",
        (start_iso, end_iso),
    ).fetchall()


def mark_sent(conn: sqlite3.Connection, endpoint: str, activity_id: int, sent_on: str) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO reminders_sent (endpoint, activity_id, sent_on) VALUES (?, ?, ?)",
        (endpoint, activity_id, sent_on),
    )


def prune(conn: sqlite3.Connection, before_iso: str) -> None:
    conn.execute("DELETE FROM bookings WHERE start < ?", (before_iso,))
    conn.execute("DELETE FROM reminders_sent WHERE sent_on < date('now', '-30 days')")
