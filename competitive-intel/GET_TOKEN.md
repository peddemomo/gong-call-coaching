# How to Get Your MCP Auth Token

There are several ways to get your MCP authentication token:

## Option 1: Use Secret Key (Easiest - if available)

If you have access to the `ACUITY_MCP_SECRET_KEY` (used for internal service-to-service calls), you might be able to use it directly:

1. Add it to your `.env`:
   ```env
   ACUITY_MCP_SECRET_KEY=your-secret-key-here
   ```

2. Run the helper script:
   ```bash
   npm run get-token
   ```

   The script will test if the secret key works as an auth token.

## Option 2: Manual OAuth Flow

1. **Get the OAuth Client ID** from your MCP service administrator or check the service configuration.

2. **Generate a code verifier and challenge** (for PKCE):
   ```bash
   # You can use the helper script:
   npm run get-token
   ```

3. **Visit the authorization URL** (the script will generate this for you):
   ```
   https://mcp-service-kdu5v7y7ca-ue.a.run.app/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/oauth/callback&response_type=code&code_challenge=YOUR_CHALLENGE&code_challenge_method=S256
   ```

4. **Sign in** with your @acuitymd.com Google account

5. **Copy the authorization code** from the redirect URL (the `code` parameter)

6. **Exchange it for a token** using the helper script or manually:
   ```bash
   curl -X POST https://mcp-service-kdu5v7y7ca-ue.a.run.app/oauth/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code&code=YOUR_CODE&redirect_uri=http://localhost:3000/oauth/callback&code_verifier=YOUR_VERIFIER"
   ```

## Option 3: Ask Your Team

The easiest way might be to:
- Check the `#proj-gong-mcp` Slack channel
- Ask your MCP service administrator
- Check if there's a shared token for internal tools

## Option 4: Use ChatGPT Integration

If you have access to the Gong MCP via ChatGPT:
1. Connect to Gong MCP in ChatGPT
2. The token is managed automatically
3. You might be able to extract it from ChatGPT's network requests (check browser DevTools)

## Testing Your Token

Once you have a token, test it:

```bash
curl -X POST https://mcp-service-kdu5v7y7ca-ue.a.run.app/mcp/gong-calls \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search",
      "arguments": {
        "query": "test"
      }
    },
    "id": 1
  }'
```

If you get results (or a proper error about the query), your token works!

## Adding to .env

Once you have your token, add it to `.env`:

```env
MCP_BASE_URL=https://mcp-service-kdu5v7y7ca-ue.a.run.app
MCP_AUTH_TOKEN=your-token-here
```

