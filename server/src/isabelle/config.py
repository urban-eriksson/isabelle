import os

DB_PATH = os.environ.get("ISABELLE_DB", "./isabelle.db")
VAPID_PRIVATE = os.environ.get("ISABELLE_VAPID_PRIVATE", "")
VAPID_PUBLIC = os.environ.get("ISABELLE_VAPID_PUBLIC", "")
VAPID_SUBJECT = os.environ.get("ISABELLE_VAPID_SUBJECT", "mailto:noreply@isabelle.korist.se")
WEB_URL = os.environ.get("ISABELLE_WEB_URL", "https://isabelle.korist.se")
TIMEZONE = os.environ.get("ISABELLE_TIMEZONE", "Europe/Stockholm")
# Browsers on GitHub Pages / localhost during development; production is same-origin.
CORS_ORIGINS = [
    o for o in os.environ.get("ISABELLE_CORS_ORIGINS", "http://localhost:8011").split(",") if o
]
