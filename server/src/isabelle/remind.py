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

from pywebpush import WebPushException, webpush

from isabelle import config, store

log = logging.getLogger("isabelle.remind")

DAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"]


def message(row) -> tuple[str, str]:
    start = datetime.strptime(row["start"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)
    local = start.astimezone(ZoneInfo(config.TIMEZONE))
    location = row["location"].replace("Stockholm -", "").strip()
    where = f" på {location}" if location else ""
    who = f" med {row['instructor']}" if row["instructor"] else ""
    if row["waiting"]:
        title = f"Du står i kö till {row['activity']} idag"
    else:
        title = f"Du har {row['activity']} idag"
    body = f"{local.strftime('%H:%M')}{where}{who}"
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
            title, body = message(row)
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
