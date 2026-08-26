"""Morning reminder job: one push per booking that starts today (local time).

Run by a systemd timer at 05:00 Europe/Stockholm:  python -m isabelle.remind
Idempotent: a booking is reminded about once, so rerunning is harmless. A 404
or 410 from the push service means the browser dropped the subscription, and
the row goes with it.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import urllib.request

from pywebpush import WebPushException, webpush

from isabelle import config, store

log = logging.getLogger("isabelle.remind")

FRISKIS_API = "https://friskissvettis.brpsystems.com/brponline/api/ver3"


def fresh_facts(row) -> dict:
    """Re-fetch the class from the public Friskis API just before pushing: the
    synced copy may be hours old and the time, instructor or cancellation
    status can have changed overnight. Best effort — on any failure the synced
    data is used as-is."""
    facts = {
        "start": row["start"],
        "instructor": row["instructor"],
        "location": row["location"],
        "cancelled": False,
    }
    if not row["business_unit_id"]:
        return facts
    url = f"{FRISKIS_API}/businessunits/{row['business_unit_id']}/groupactivities/{row['activity_id']}"
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            item = json.load(response)
        facts["cancelled"] = bool(item.get("cancelled"))
        start = item.get("duration", {}).get("start")
        if start:
            facts["start"] = (
                datetime.fromisoformat(start.replace("Z", "+00:00"))
                .astimezone(UTC)
                .strftime("%Y-%m-%dT%H:%M:%SZ")
            )
        instructors = item.get("instructors") or []
        if instructors:
            facts["instructor"] = instructors[0].get("name", facts["instructor"])
        unit = item.get("businessUnit", {}).get("name")
        if unit:
            facts["location"] = unit
    except Exception as err:
        log.warning("could not refresh activity %s: %s", row["activity_id"], err)
    return facts


def message(row, facts: dict) -> tuple[str, str]:
    start = datetime.strptime(facts["start"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)
    local = start.astimezone(ZoneInfo(config.TIMEZONE))
    location = facts["location"].replace("Stockholm -", "").strip()
    where = f" på {location}" if location else ""
    who = f" med {facts['instructor']}" if facts["instructor"] else ""
    when_where = f"{local.strftime('%H:%M')}{where}"
    if facts["cancelled"]:
        title = f"{row['activity']} idag är inställt"
        body = f"Passet {when_where} har ställts in."
    elif row["waiting"]:
        title = f"Du står i kö till {row['activity']} idag"
        body = f"{when_where}{who}"
    else:
        title = f"Du har {row['activity']} idag"
        body = f"{when_where}{who}"
    return title, body


def run(now: datetime | None = None) -> int:
    if not (config.VAPID_PRIVATE and config.VAPID_PUBLIC):
        log.error("VAPID keys are not configured")
        return 1
    tz = ZoneInfo(config.TIMEZONE)
    now = now or datetime.now(tz)
    day_start = now.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    fmt = "%Y-%m-%dT%H:%M:%SZ"
    start_iso = day_start.astimezone(UTC).strftime(fmt)
    end_iso = day_end.astimezone(UTC).strftime(fmt)
    today = day_start.strftime("%Y-%m-%d")

    sent = 0
    dead: list[str] = []
    with store.connect() as conn:
        store.prune(conn, now.astimezone(UTC).strftime(fmt))
        rows = store.bookings_between(conn, start_iso, end_iso)
        log.info("%d booking(s) due today", len(rows))
        for row in rows:
            if row["endpoint"] in dead:
                continue
            title, body = message(row, fresh_facts(row))
            payload = json.dumps(
                {"title": title, "body": body, "url": config.WEB_URL}, ensure_ascii=False
            )
            try:
                webpush(
                    subscription_info={
                        "endpoint": row["endpoint"],
                        "keys": {"p256dh": row["p256dh"], "auth": row["auth"]},
                    },
                    data=payload,
                    vapid_private_key=config.VAPID_PRIVATE,
                    vapid_claims={"sub": config.VAPID_SUBJECT},
                    ttl=12 * 3600,
                )
                store.mark_sent(conn, row["endpoint"], row["activity_id"], today)
                sent += 1
            except WebPushException as err:
                code = err.response.status_code if err.response is not None else None
                if code in (404, 410):
                    dead.append(row["endpoint"])
                else:
                    log.warning("push failed (%s): %s", code, err)
            except Exception:
                log.exception("push raised")
        if dead:
            store.delete_subscriptions(conn, dead)
            log.info("dropped %d dead subscription(s)", len(dead))
    log.info("sent %d reminder(s)", sent)
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    sys.exit(run())
