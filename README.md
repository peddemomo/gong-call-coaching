# Gong Call Coaching

Internal app for generating and sending AI-powered sales coaching emails
based on Gong calls.

## Quick Start

### 1. Start the Database and Run Migrations

```bash
docker compose up db -d
docker compose --profile tools run --rm liquibase update
```

### 2. Start the API

```bash
cd api
cp .env.example .env
npm install
npm run dev
```

The API will be running at http://localhost:3000

### 3. Start the Web App

```bash
cd web
npm install
npm run dev
```

The web app will be running at http://localhost:5173

#### Web Environment Variables

Create a `web/.env` file (optional, defaults work for local dev):

```
VITE_API_BASE_URL=http://localhost:3000
```

## API

The backend API is a Node + Express + TypeScript server.

### Endpoints

- `GET /health` - Health check, returns `{ "ok": true }`
- `GET /aes` - Returns all account executives from the database
- `POST /aes` - Create a new AE
  - Body: `{ "email": "user@example.com" }`
  - Returns: The created AE object
  - Returns 409 if email already exists
- `GET /prompt` - Returns the active prompt (or empty default if none)
- `PUT /prompt` - Update the active prompt
  - Body: `{ "body": "Your prompt text here" }`
  - Returns: The created prompt object
  - Deactivates all previous prompts
- `GET /email-logs` - Returns the 100 most recent email logs (read-only audit view)
- `POST /generate` - Generate a coaching email (does not send yet)
  - Body: `{ "ae_email": "user@example.com", "gong_call_id": "call_123" }`
  - Returns: The created email_log row with status 'queued'
  - Returns 409 if already generated for this AE + call combination

### Testing with curl

```bash
# Health check
curl http://localhost:3000/health

# Get all AEs
curl http://localhost:3000/aes

# Create an AE
curl -X POST http://localhost:3000/aes \
  -H "Content-Type: application/json" \
  -d '{"email": "jane@example.com"}'

# Get active prompt
curl http://localhost:3000/prompt

# Update prompt
curl -X PUT http://localhost:3000/prompt \
  -H "Content-Type: application/json" \
  -d '{"body": "You are a sales coach. Analyze this call and provide feedback."}'

# Get email logs (100 most recent)
curl http://localhost:3000/email-logs

# Generate a coaching email (placeholder, does not send)
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{"ae_email": "jane@example.com", "gong_call_id": "call_123"}'
```

## Database

### Manual database commands

Start the database:
```bash
docker compose up db -d
```

Run migrations:
```bash
docker compose --profile tools run --rm liquibase update
```

Check migration status:
```bash
docker compose --profile tools run --rm liquibase status
```

Rollback last migration:
```bash
docker compose --profile tools run --rm liquibase rollback-count 1
```
