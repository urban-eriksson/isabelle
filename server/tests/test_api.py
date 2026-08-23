import os, tempfile
os.environ["ISABELLE_DB"] = os.path.join(tempfile.mkdtemp(), "t.db")
os.environ["ISABELLE_VAPID_PRIVATE"] = "x"
os.environ["ISABELLE_VAPID_PUBLIC"] = "y"
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient
from isabelle import main, remind, store


def test_sync_and_remind(monkeypatch):
    c = TestClient(main.app)
    assert c.get("/api/push/key").json() == {"key": "y"}
    body = {
        "endpoint": "https://push.example/abc",
        "keys": {"p256dh": "p", "auth": "a"},
        "bookings": [
            {"id": 1, "activity": "Yoga", "start": "2026-08-24T15:00:00.000Z", "location": "Stockholm - Kungsholmen", "instructor": "Jane Doe"},
            {"id": 2, "activity": "Spin", "start": "2026-08-25T06:00:00.000Z", "waiting": True},
        ],
    }
    assert c.put("/api/subscriptions", json=body).json() == {"bookings": 2}

    sent = []
    monkeypatch.setattr(remind, "webpush", lambda **kw: sent.append(kw))
    now = datetime(2026, 8, 24, 5, 0, tzinfo=ZoneInfo("Europe/Stockholm"))
    assert remind.run(now) == 0
    assert len(sent) == 1
    assert '"Du har Yoga idag"' in sent[0]["data"]
    assert "17:00 på Kungsholmen med Jane Doe" in sent[0]["data"]
    # rerun the same morning: nothing new
    assert remind.run(now) == 0 and len(sent) == 1
    # next day: the waiting-list one
    assert remind.run(datetime(2026, 8, 25, 5, 0, tzinfo=ZoneInfo("Europe/Stockholm"))) == 0
    assert len(sent) == 2 and "Du står i kö till Spin idag" in sent[1]["data"]

    assert c.request("DELETE", "/api/subscriptions", json={"endpoint": body["endpoint"]}).json() == {"subscribed": False}
    with store.connect() as conn:
        assert conn.execute("select count(*) from bookings").fetchone()[0] == 0
