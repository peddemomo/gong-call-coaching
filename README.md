# Gong Call Coaching

Internal app for generating and sending AI-powered sales coaching emails
based on Gong calls.

## Local development

Run all services:
```bash
docker compose up
```

## Database

Start the database and run migrations:
```bash
docker compose up db -d
docker compose run --rm liquibase update
```

## API

The backend API is a Node + Express + TypeScript server.

### Setup

1. Start the database:
   ```bash
   docker compose up db -d
   ```

2. Run database migrations:
   ```bash
   docker compose run --rm liquibase update
   ```

3. Set up the API:
   ```bash
   cd api
   cp .env.example .env
   npm install
   npm run dev
   ```

The API will be running at http://localhost:3000

### Endpoints

- `GET /health` - Health check, returns `{ "ok": true }`
- `GET /aes` - Returns all account executives from the database

### Testing with curl

```bash
# Health check
curl http://localhost:3000/health

# Get all AEs
curl http://localhost:3000/aes
```
