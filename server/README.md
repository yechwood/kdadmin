# Kodroid Server

First working server layer for Kodroid + KDAdmin.

It provides account registration/login, device registration, six-digit pairing, per-device command queues, 24-hour offline command retention, polling, heartbeats, acknowledgements, and an allow-list matching the OwnDroid actions verified in the OwnDroid source.

## Deployment

Put this directory on an always-on Linux host, replace YOUR_HOSTNAME_HERE in Caddyfile, point DNS A/AAAA to the host, ensure ports 80/443 are reachable, then run:

docker compose up -d --build

Caddy can automatically obtain and renew public TLS certificates when the hostname resolves to the server and ports 80/443 are reachable.

## API

GET /v1/health
POST /v1/auth/register
POST /v1/auth/login
POST /v1/devices/register
POST /v1/devices/pair/start
POST /v1/devices/pair/claim
GET /v1/devices
POST /v1/devices/:id/commands
GET /v1/devices/:id/poll
POST /v1/devices/:id/ack
POST /v1/devices/:id/heartbeat
GET /v1/devices/:id/history

The Android clients are the next step: they will use this protocol and remove the developer-facing server/API-key form from normal operation.

Before public deployment we should add rate limiting, stronger request validation, session rotation/revocation, encrypted secrets at rest, and an administrative bootstrap mechanism.
