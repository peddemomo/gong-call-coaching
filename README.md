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

### Strategy-scoped Endpoints

- `GET /strategies` - List all strategies
- `POST /strategies` - Create a new strategy
  - Body: `{ "name": "My Strategy" }`
- `GET /strategies/:strategyId/aes` - List AEs for a strategy
- `POST /strategies/:strategyId/aes` - Add AE to a strategy
  - Body: `{ "email": "user@example.com" }`
  - Returns 409 if AE already belongs to another strategy
- `DELETE /strategies/:strategyId/aes/:aeId` - Remove AE from strategy
- `PATCH /strategies/aes/:aeId/move` - Move AE to different strategy
  - Body: `{ "strategy_id": "uuid" }`
- `GET /strategies/:strategyId/prompt` - Get active prompt for strategy
- `PUT /strategies/:strategyId/prompt` - Update prompt for strategy
- `GET /strategies/:strategyId/email-logs` - List email logs for strategy
- `POST /strategies/:strategyId/generate` - Generate email for AE in strategy
  - Body: `{ "ae_email": "user@example.com", "gong_call_id": "call_123", "call_title?": "Discovery Call", "call_date?": "2025-01-14", "external_emails?": ["client@example.com"] }`
  - Returns 400 if AE not in this strategy
  - Returns 409 if already generated for this call

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

# ============ Strategy-scoped examples ============

# List all strategies
curl http://localhost:3000/strategies

# Create a new strategy
curl -X POST http://localhost:3000/strategies \
  -H "Content-Type: application/json" \
  -d '{"name": "Enterprise Sales"}'

# Add AE to a strategy (use default strategy ID as example)
curl -X POST http://localhost:3000/strategies/00000000-0000-0000-0000-000000000001/aes \
  -H "Content-Type: application/json" \
  -d '{"email": "jane@example.com"}'

# Generate email for AE in strategy (with optional context)
curl -X POST http://localhost:3000/strategies/00000000-0000-0000-0000-000000000001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "ae_email": "jane@example.com",
    "gong_call_id": "1234567890",
    "call_title": "Discovery Call with Acme Corp",
    "call_date": "2025-01-14"
  }'

# Get email logs for a strategy
curl http://localhost:3000/strategies/00000000-0000-0000-0000-000000000001/email-logs
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
