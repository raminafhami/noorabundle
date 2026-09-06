# APK server deployment

This directory runs the frontend, backend, MongoDB, and Redis as a production Docker Compose stack.

## Server prerequisites

- Linux server with Docker Engine and Docker Compose v2
- At least 4 GB RAM (8 GB recommended while images are building)
- A reverse proxy such as Nginx or Caddy with TLS certificates
- DNS records for the application and API domains

## First deployment

1. Copy both repository directories and this `server-deployment` directory while preserving their relative layout.
2. Copy `.env.server.example` to `.env.server`.
3. Replace every `CHANGE_ME` value and set the real `PUBLIC_APP_URL` and `PUBLIC_API_URL`.
4. Set `SEED_SUPER_ADMIN_PHONE` and `SEED_SUPER_ADMIN_PASSWORD`. On every
   backend start, the application ensures that the `super-admin` and
   `system-admin` roles and this
   user exist. Existing accounts are activated and assigned to the role without
   duplicating the account or changing its password.
5. Validate and start:

```bash
docker compose --env-file .env.server -f docker-compose.server.yml config
docker compose --env-file .env.server -f docker-compose.server.yml build
docker compose --env-file .env.server -f docker-compose.server.yml up -d
docker compose --env-file .env.server -f docker-compose.server.yml ps
```

The services bind to `127.0.0.1` by default. Configure the reverse proxy to send the application domain to `127.0.0.1:3000` and the API domain (including WebSocket upgrade headers) to `127.0.0.1:4000`.

MongoDB, Redis, and Elasticsearch remain isolated on Docker's internal network and are not exposed publicly.

## Updating

After replacing the source with a newer version:

```bash
docker compose --env-file .env.server -f docker-compose.server.yml build --pull
docker compose --env-file .env.server -f docker-compose.server.yml up -d --remove-orphans
```

## Operations

```bash
docker compose --env-file .env.server -f docker-compose.server.yml logs -f --tail=200
docker compose --env-file .env.server -f docker-compose.server.yml restart frontend backend
docker compose --env-file .env.server -f docker-compose.server.yml down
```

Do not run `down -v` on a production server; `-v` deletes the database and uploaded-file volumes. Back up the MongoDB and named file volumes before upgrades.

## Startup super-admin

The startup seed is enabled by default in `docker-compose.server.yml`. Confirm
its result after deployment:

```bash
docker compose --env-file .env.server -f docker-compose.server.yml logs backend | grep -E "super-admin|SeederService"
```

Expected on the first start:

```text
Created super-admin group.
Created system-admin group.
Created seeded super-admin user (super-admin).
```

Expected on later starts:

```text
Verified seeded super-admin user (super-admin).
```

Normal restarts never overwrite the current password. To intentionally reset it,
change `SEED_SUPER_ADMIN_PASSWORD`, set `SEED_SUPER_ADMIN_RESET_PASSWORD=true`,
recreate the backend container once, and immediately return the flag to `false`.

To disable this startup check explicitly, set `SEED_SUPER_ADMIN_ENABLED=false`.
Never commit a production `.env.server` file to source control.

## Business-process and initial-data seed

Every backend start scans `noora-flow-main/statics/bpmn/active` and imports only
missing process keys. Approved inspection, sampling, finance, HR, secretariat,
invoice and CMS processes are included. Files under `statics/bpmn/archive` are
kept for reference and are never imported.

After the backend becomes healthy, the one-shot `demo-seeder` service creates
missing sample records for contacts, projects and tasks, tickets, training,
personnel contracts, audits, inventory and runnable process instances. Matching
records are skipped, so rerunning it does not intentionally duplicate data.
Set `DEMO_SEED_ENABLED=false` when presentation/sample data is not desired.

Inspect its result with:

```bash
docker compose --env-file .env.server -f docker-compose.server.yml logs demo-seeder
```

## Isolated local verification before deployment

On Windows with Docker Desktop, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\test-local.ps1
```

For a completely fresh local database and a full initial-data verification,
use `-ResetData`. This deletes only the isolated `apk-superadmin-test` volumes:

```powershell
powershell -ExecutionPolicy Bypass -File .\test-local.ps1 -ResetData
```

This builds the exact server bundle as the isolated Compose project
`apk-superadmin-test`. It uses separate containers and named volumes and exposes
the test frontend at `http://localhost:3200` and backend at
`http://localhost:4200`, so an existing local installation on ports 3000/4000
is not modified.

Stop the test environment without deleting its test data:

```powershell
powershell -ExecutionPolicy Bypass -File .\stop-local-test.ps1
```
