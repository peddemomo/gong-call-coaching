# Gong Competitive Intelligence Digest

A tool that analyzes the past week's Gong calls for competitor mentions and sends a summarized digest via email.

## Features

- **Automatic Date Range**: Analyzes calls from the previous business week (Monday - Friday)
- **Competitor Detection**: Monitors for known competitors:
  - Definitive Healthcare
  - MedScout
  - RepSignal
  - Axiom
  - IQVIA
  - Carevoyance
- **General Competitor Discovery**: Also detects mentions of unknown competitors, alternatives, and competitive comparisons
- **AI-Powered Analysis**: Uses GPT-4o to understand context and sentiment
- **Executive Summary**: Generates actionable insights, trends, and recommendations
- **Beautiful Email Reports**: HTML emails with detailed breakdowns by competitor

## Setup

### 1. Install Dependencies

```bash
cd competitive-intel
npm install
```

### 2. Configure Environment Variables

Copy `.env` and fill in your credentials:

```bash
cp .env .env.local
```

Required variables:
- `MCP_BASE_URL` - Your Gong MCP service URL (e.g., `https://mcp-service-kdu5v7y7ca-ue.a.run.app`)
- `MCP_AUTH_TOKEN` - Your MCP OAuth JWT token (see Authentication below)
- `OPENAI_API_KEY` - Your OpenAI API key
- `SMTP_HOST` - SMTP server hostname
- `SMTP_USER` - SMTP username/email
- `SMTP_PASS` - SMTP password or app password
- `EMAIL_TO` - Recipient email address

### Authentication

The tool uses your company's Gong MCP service, which requires OAuth authentication. To get your MCP auth token:

1. **Via ChatGPT Integration** (if you have access):
   - Connect to Gong MCP in ChatGPT
   - The token is automatically managed by ChatGPT

2. **Via OAuth Flow** (for programmatic access):
   - Visit: `https://your-mcp-service-url/oauth/authorize?client_id=your-client-id&redirect_uri=your-redirect-uri&response_type=code`
   - Sign in with your @acuitymd.com Google account
   - Exchange the auth code for a JWT token at `/oauth/token`
   - Use the `access_token` as `MCP_AUTH_TOKEN`

3. **For Development/Testing**:
   - If you have the `ACUITY_MCP_SECRET_KEY`, you can use it directly as `MCP_AUTH_TOKEN` (if your MCP service allows secret key bypass)

See the [Gong MCP documentation](file://8bf79a12-e4f3-46af-8242-cce42adcc99c_GONG_ChatGPT_Service.pdf) for more details.

### 3. SMTP Configuration Examples

**Gmail (with App Password):**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
```

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

**AWS SES:**
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-user
SMTP_PASS=your-ses-smtp-password
```

## Usage

### Run Manually

```bash
npm run digest
```

### Schedule with Cron (Weekly on Monday)

To run every Monday at 9am:

```bash
# Edit crontab
crontab -e

# Add this line (adjust path as needed)
0 9 * * 1 cd /path/to/competitive-intel && npm run digest >> /var/log/competitive-digest.log 2>&1
```

### Run with Docker

```bash
# Build
docker build -t gong-competitive-intel .

# Run
docker run --env-file .env gong-competitive-intel
```

## How It Works

1. **Search via MCP**: Uses your company's Gong MCP service to semantically search for competitor mentions from the past business week
2. **Fetch Relevant Snippets**: Retrieves call snippets where competitors are mentioned (more efficient than downloading all transcripts)
3. **Analyze**: Uses GPT-4o-mini to identify competitor mentions, context, and sentiment
4. **Summarize**: Generates an executive summary with trends and action items
5. **Email**: Sends a beautifully formatted HTML digest

**Advantages of using MCP:**
- More efficient: Only fetches relevant call snippets, not entire transcripts
- Semantic search: Finds competitor mentions even if exact names aren't used
- Faster: Leverages pre-computed embeddings for instant search
- Better coverage: Can discover competitors not in the known list

## Output Example

The digest email includes:

- **Stats**: Total calls analyzed, calls with mentions, total mention count
- **Executive Summary**: AI-generated overview of competitive landscape
- **Key Trends**: Notable patterns in competitive discussions
- **Recommended Actions**: Suggested next steps
- **Detailed Mentions**: Each mention grouped by competitor with:
  - Call title (linked to Gong)
  - Date
  - Context quote
  - Sentiment indicator (🟢 positive, 🟡 neutral, 🔴 negative)
  - Key points extracted

## Customizing Competitors

Edit `src/services/competitorAnalyzer.ts` to modify the known competitors list:

```typescript
const KNOWN_COMPETITORS = [
  "Definitive Healthcare",
  "MedScout",
  "RepSignal",
  "Axiom",
  "IQVIA",
  "Carevoyance",
  // Add more here
];
```

## API Rate Limits

- **Gong API**: Batches transcript requests in groups of 50
- **OpenAI API**: Processes 5 calls in parallel with 500ms delays between batches
- Transcripts over 15,000 characters are truncated to manage token usage

## Troubleshooting

**No calls found**
- Check your date range - the tool looks at the *previous* business week
- Verify Gong API credentials have access to call data

**Email not sending**
- Verify SMTP credentials
- For Gmail, ensure you're using an App Password (not your regular password)
- Check if less secure app access or 2FA is affecting authentication

**OpenAI errors**
- Verify your API key has GPT-4o access
- Check your OpenAI account has sufficient credits

