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
4. Validate and start:

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
