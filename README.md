# Gong Call Coaching

Internal app for generating and sending AI-powered sales coaching emails
based on Gong calls.

## Quick Start

**If you get `command not found: npm`** in Cursor’s terminal, use the project scripts instead (they set up Node for you):

- **API:** `./dev-api.sh`
- **Web:** `./dev-web.sh`

Run each in a separate terminal. Otherwise use the steps below.

### 1. Start the Database and Run Migrations

```bash
docker compose up db -d
docker compose --profile tools run --rm liquibase update
```

### 2. Start the API

```bash
cd api
npm install
npm run dev
```

The API will be running at http://localhost:3000

#### API Environment Variables

Create an `api/.env` file with the following:

```
# Database connection
DATABASE_URL=postgres://postgres:postgres@localhost:5432/gong_coaching

# Frontend URL for CORS
FRONTEND_URL=http://localhost:5173

# Server port
PORT=3000

# Gong API credentials (required for test-call feature)
# Get these from Gong Admin > Company Settings > Ecosystem > API
GONG_ACCESS_KEY=your_gong_access_key
GONG_ACCESS_SECRET=your_gong_access_secret
GONG_BASE_URL=https://api.gong.io

# ============ Authentication ============
# Google OAuth Client ID (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Restrict access to specific email domain (e.g., yourcompany.com)
# Users without this domain will be denied access
ALLOWED_EMAIL_DOMAIN=yourcompany.com

# Secret for signing JWT session tokens (use a long random string in production)
JWT_SECRET=your-secure-random-string-here
```

### 3. Start the Web App

```bash
cd web
npm install
npm run dev
```

The web app will be running at http://localhost:5173

#### Web Environment Variables

Create a `web/.env` file:

```
VITE_API_BASE_URL=http://localhost:3000

# Google OAuth Client ID (same as API - required for login)
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

## Authentication Setup

This app uses Google SSO to restrict access to authorized team members only.

### Setting up Google OAuth

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Configure OAuth Consent Screen**
   - Navigate to APIs & Services > OAuth consent screen
   - Select "Internal" if using Google Workspace (restricts to your org)
   - Or "External" for any Google account (you'll control access via ALLOWED_EMAIL_DOMAIN)
   - Fill in app name and required fields

3. **Create OAuth Credentials**
   - Navigate to APIs & Services > Credentials
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Select "Web application"
   - Add Authorized JavaScript origins:
     - `http://localhost:5173` (development)
     - Your production frontend URL (e.g., `https://yourapp.com`)
   - Add Authorized redirect URIs:
     - Same as JavaScript origins
   - Save and copy the **Client ID**

4. **Configure Environment Variables**
   - Add `GOOGLE_CLIENT_ID` to both `api/.env` and `web/.env`
   - Set `ALLOWED_EMAIL_DOMAIN` to your company domain (e.g., `yourcompany.com`)
   - Generate a secure `JWT_SECRET` for session tokens

### How Authentication Works

1. User clicks "Sign in with Google" on the login page
2. Google authenticates the user and returns an ID token
3. Frontend sends the token to `POST /auth/google`
4. Backend verifies the token with Google
5. Backend checks the email domain against `ALLOWED_EMAIL_DOMAIN`
6. If authorized, a JWT session cookie is set (valid for 7 days)
7. All subsequent API requests include the cookie for authentication

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
  - Body: `{ "ae_email": "user@example.com", "gong_call_id": "call_123", "call_title?": "Discovery Call", "call_date?": "2025-01-14", "external_emails?": ["client@example.com"], "transcript?": "..." }`
  - Runs call eligibility classifier to determine if call should receive coaching
  - Returns 200 with `{ skipped: true, reason, decision }` if classifier skips
  - Returns 201 with email_log row if classifier approves (status: "queued")
  - Returns 400 if AE not in this strategy
  - Returns 409 if already processed for this call
- `POST /strategies/:strategyId/test-call` - Run a test call through the full pipeline (dry-run)
  - Body: `{ "gong_call_id": "1234567890" }`
  - Fetches call metadata + transcript from Gong API
  - Determines primary AE from internal participants
  - Verifies AE belongs to this strategy
  - Runs classifier and generates output
  - **NEVER sends email** - creates email_log with `is_test=true` and `status='generated'`
  - Test runs can be repeated unlimited times for prompt iteration
  - Returns 200 with `{ skipped: true, reason, ae_email }` if AE not found or belongs to different strategy
  - Returns 200 with `{ skipped: true, reason, decision }` if classifier skips
  - Returns 201 with email_log row if generation succeeds

### Call Eligibility Classifier

The generate endpoint includes a call eligibility classifier that determines whether a call should receive coaching. Currently uses placeholder rules:

- **Skips** if no external emails (internal call)
- **Skips** if call title contains internal keywords (standup, interview, etc.)
- **Queues** if transcript contains sales keywords (pricing, demo, proposal, etc.)
- **Skips** if no clear sales indicators found

The classifier returns:
```json
{
  "should_send": true|false,
  "call_type": "new_business"|"expansion"|"renewal"|"support"|"internal"|"partner"|"unknown",
  "confidence": 0.0-1.0,
  "reason": "Human readable explanation"
}
```

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

# Generate email - example that QUEUES (has external emails + sales transcript)
curl -X POST http://localhost:3000/strategies/00000000-0000-0000-0000-000000000001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "ae_email": "jane@example.com",
    "gong_call_id": "call_001",
    "call_title": "Discovery Call with Acme Corp",
    "call_date": "2025-01-14",
    "external_emails": ["buyer@acme.com", "cto@acme.com"],
    "transcript": "Thanks for joining the demo today. Let me walk you through our pricing options and discuss next steps for the proposal."
  }'
# Returns: { id, status: "queued", decision: { should_send: true, call_type: "new_business", ... } }

# Generate email - example that SKIPS (no external emails - internal call)
curl -X POST http://localhost:3000/strategies/00000000-0000-0000-0000-000000000001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "ae_email": "jane@example.com",
    "gong_call_id": "call_002",
    "call_title": "Weekly team sync"
  }'
# Returns: { skipped: true, reason: "No external participants detected - appears to be an internal call", decision: {...} }

# Generate email - example that SKIPS (no sales keywords in transcript)
curl -X POST http://localhost:3000/strategies/00000000-0000-0000-0000-000000000001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "ae_email": "jane@example.com",
    "gong_call_id": "call_003",
    "call_title": "Support call",
    "external_emails": ["support@acme.com"],
    "transcript": "Hi, I am having trouble with my account. Can you help me reset my password?"
  }'
# Returns: { skipped: true, reason: "Not clearly a new business prospect call...", decision: {...} }

# Get email logs for a strategy
curl http://localhost:3000/strategies/00000000-0000-0000-0000-000000000001/email-logs

# ============ Test Call examples ============

# Run a test call - fetches call from Gong and runs full pipeline (never sends email)
# This is useful for testing prompts and verifying the pipeline works correctly
curl -X POST http://localhost:3000/strategies/00000000-0000-0000-0000-000000000001/test-call \
  -H "Content-Type: application/json" \
  -d '{"gong_call_id": "1234567890123456789"}'
# Returns: { id, ae_email, status: "generated", is_test: true, subject, body, decision, ... }
# Or if skipped: { skipped: true, reason: "...", ae_email, decision }

# Test calls can be repeated any number of times - great for prompt iteration!
# Each run creates a new email_log row with a unique test_run_id
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
