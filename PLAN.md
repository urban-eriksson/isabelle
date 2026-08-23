# Isabelle upgrade plan (August 2026)

Verified facts (2026-08-22) about the Friskis & Svettis API that the plan builds on:

- The public `groupactivities` endpoint already returns capacity per class:
  `slots: {total, totalBookable, reservedForDropin, leftToBook, leftToBookIncDropin, hasWaitingList, inWaitingList}`,
  plus `cancelled`, `bookableEarliest`, `bookableLatest`, `externalMessage`, and the class `id`.
- The new "Mitt Friskis" site (friskissvettis.goactivebooking.com, appId 59) uses the same
  `https://friskissvettis.brpsystems.com/brponline/api/ver3` host:
  - `POST /auth/login {username, password}` → `{accessToken, refreshToken, expiresAt}` (email + password only)
  - `POST /oauth/access_token {grant_type: "refresh_token", refresh_token}`
  - `GET  /customers/{id}/bookings/groupactivities`
  - `POST /customers/{id}/bookings/groupactivities {groupActivity, allowWaitingList}`
  - `DELETE /customers/{id}/bookings/groupactivities/{bookingId}`
- CORS is `Access-Control-Allow-Origin: *` with the `authorization` header allowed, so all of the
  above can be called straight from the browser. No proxy, and the server never sees a Friskis password.

## Step 1 — capacity in the list (frontend only)

- Keep `id`, `slots`, `cancelled`, booking window and `externalMessage` in `transformItem()`.
- Show `booked/total` on each row (e.g. `41/43`), and the waiting-list count when full.
- Tint rows: red when full, orange when nearly full (≤ 3 spots or ≤ 10 %), grey strike-through when cancelled.
- Persist the per-gym API cache in localStorage (valid for the day) so navigating between pages
  does not refetch all 27 gyms.

## Step 2 — PWA

- Fill in `site.webmanifest` (name "Isabelle", `start_url`, `scope`), add a minimal service worker
  that caches the app shell and the last successful API responses.

## Step 3 — bottom drawer with booking (frontend only)

- Tapping a row opens a bottom drawer with full details: room, both instructors, end time,
  `externalMessage`, booking window, spots, waiting list.
- "Logga in" (Friskis email + password) stored as access/refresh token in localStorage.
- Drawer gets "Boka" / "Ställ i kö" / "Avboka" buttons; the user's own bookings are highlighted
  in the list (green).

## Deploying (step 4 onwards)

```bash
# 1. Infra: certificate (us-east-1) + S3/CloudFront/DNS/deploy bucket (eu-north-1).
#    Also uploads the static app. Re-run this (or scripts/deploy-web.sh) after frontend changes.
cd infra && npx aws-cdk deploy IsabelleCert Isabelle --require-approval never

# 2. Server: package server/ + scripts/provision.sh, push via S3 + SSM to the snicksnack box.
#    provision.sh is idempotent: swap file, isabelle user, VAPID keys, Caddy block, systemd units/timers.
scripts/deploy-server.sh
```

Ops on the box (via `aws ssm start-session --target <instance>` or send-command):
`systemctl status isabelle isabelle-remind.timer`, `journalctl -u isabelle-remind`,
`sudo -u isabelle env $(cat /etc/isabelle/env /etc/isabelle/settings | xargs) /usr/local/bin/uv run --directory /opt/isabelle/app python -m isabelle.remind`
to send today's reminders by hand. DB: `/var/lib/isabelle/isabelle.db`, backed up nightly to the Isabelle BackupBucket.

## Step 4 — nightly reminders via Web Push (needs a small backend)

- Anonymous: identity is the push subscription itself, nothing syncs across devices, no login on our side.
- When the app is open and the user is logged in to Friskis, the browser fetches the user's upcoming
  bookings and syncs `{subscription, bookings: [{id, activity, start, location, instructor}]}` to the server.
- A systemd timer runs early each morning and pushes "Du har Yoga idag 17:00 på Kungsholmen med Jane Doe"
  for every booking due that day.
- Hosting: the existing snicksnack t3.micro. New Caddy site block `isabelle.korist.se` → `127.0.0.1:8001`,
  new A record to the existing Elastic IP, new systemd unit + timer, FastAPI + SQLite + pywebpush
  (same stack as snicksnack). Provision via SSM, not by editing `user_data.sh` (changing user data
  stop/starts the instance).
- The static frontend can stay on GitHub Pages, or move to `isabelle.korist.se` served by Caddy.
