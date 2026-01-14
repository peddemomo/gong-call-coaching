import "dotenv/config";
import axios from "axios";
import * as crypto from "crypto";
import * as readline from "readline";

/**
 * Helper script to get MCP OAuth token
 * 
 * This script helps you authenticate with the Gong MCP service and get a JWT token.
 * 
 * Usage:
 *   ts-node src/scripts/getMcpToken.ts
 */

const MCP_BASE_URL = process.env.MCP_BASE_URL || "https://mcp-service-kdu5v7y7ca-ue.a.run.app";
const REDIRECT_URI = "http://localhost:3000/oauth/callback"; // Standard redirect for OAuth

// Generate PKCE code challenge
function generateCodeChallenge(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

async function getTokenViaSecretKey(): Promise<string | null> {
  const secretKey = process.env.ACUITY_MCP_SECRET_KEY;
  if (!secretKey) {
    console.log("ℹ️  ACUITY_MCP_SECRET_KEY not found in environment");
    return null;
  }

  console.log("🔑 Testing ACUITY_MCP_SECRET_KEY...");
  
  // Try method 1: Secret key as Bearer token
  try {
    const testResponse = await axios.post(
      `${MCP_BASE_URL}/mcp/gong-calls`,
      {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "search",
          arguments: { query: "test" },
        },
        id: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!testResponse.data.error) {
      console.log("✅ Secret key works as Bearer token!");
      return secretKey;
    }
  } catch (error) {
    // Try method 2: Secret key as header (x-acuity-mcp-secret-key)
    try {
      const testResponse2 = await axios.post(
        `${MCP_BASE_URL}/mcp/gong-calls`,
        {
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "search",
            arguments: { query: "test" },
          },
          id: 1,
        },
        {
          headers: {
            "x-acuity-mcp-secret-key": secretKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!testResponse2.data.error) {
        console.log("✅ Secret key works as header! (But you'll need a JWT token for Bearer auth)");
        console.log("   The secret key bypasses auth, but the tool expects a Bearer token.");
        console.log("   You may need to use OAuth to get a proper JWT token.");
        return null; // Still need a proper token
      }
    } catch (error2) {
      console.log("❌ Secret key doesn't work in either format");
    }
  }

  return null;
}

async function getTokenViaOAuth(): Promise<string | null> {
  console.log("\n📋 OAuth Flow Instructions:");
  console.log("=" .repeat(60));
  console.log("\n1. We'll generate an authorization URL");
  console.log("2. Open it in your browser and sign in with your @acuitymd.com Google account");
  console.log("3. After authorization, you'll be redirected");
  console.log("4. Copy the 'code' parameter from the redirect URL");
  console.log("\n" + "=".repeat(60) + "\n");

  const { codeVerifier, codeChallenge } = generateCodeChallenge();

  // For OAuth, we need a client_id, but the MCP service might use a fixed one
  // Let's try a common pattern or ask the user
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(query, resolve);
    });
  };

  console.log("Note: The MCP service requires a client_id for OAuth.");
  console.log("You may need to get this from your MCP service administrator.");
  console.log("Or check if there's a public OAuth client ID.\n");

  const clientId = await question("Enter OAuth client_id (or press Enter to skip): ");
  rl.close();

  if (!clientId || clientId.trim() === "") {
    console.log("\n⚠️  Skipping OAuth flow. You'll need to get the token manually.");
    return null;
  }

  const authUrl = `${MCP_BASE_URL}/oauth/authorize?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `code_challenge=${codeChallenge}&` +
    `code_challenge_method=S256`;

  console.log("\n🌐 Open this URL in your browser:\n");
  console.log(authUrl);
  console.log("\n");

  const authCode = await question("After signing in, paste the 'code' from the redirect URL: ");

  if (!authCode || authCode.trim() === "") {
    console.log("❌ No auth code provided");
    return null;
  }

  try {
    const tokenResponse = await axios.post(
      `${MCP_BASE_URL}/oauth/token`,
      {
        grant_type: "authorization_code",
        code: authCode.trim(),
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    if (accessToken) {
      console.log("\n✅ Successfully obtained access token!");
      return accessToken;
    } else {
      console.log("❌ No access token in response:", tokenResponse.data);
      return null;
    }
  } catch (error: unknown) {
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as { response?: { data?: unknown } };
      console.error("❌ Token exchange failed:", JSON.stringify(axiosError.response?.data, null, 2));
    } else {
      console.error("❌ Token exchange failed:", error);
    }
    return null;
  }
}

async function main() {
  console.log("🔐 MCP Token Helper");
  console.log("=" .repeat(60));
  console.log(`MCP Service URL: ${MCP_BASE_URL}\n`);

  // Try secret key first (easiest if available)
  let token = await getTokenViaSecretKey();
  
  if (!token) {
    // Try OAuth flow
    token = await getTokenViaOAuth();
  }

  if (token) {
    console.log("\n" + "=".repeat(60));
    console.log("✅ Your MCP Auth Token:");
    console.log("=".repeat(60));
    console.log(token);
    console.log("=".repeat(60));
    console.log("\n📝 Add this to your .env file:");
    console.log(`MCP_AUTH_TOKEN=${token}\n`);
  } else {
    console.log("\n❌ Could not obtain token. Options:");
    console.log("1. Check if you have ACUITY_MCP_SECRET_KEY in your environment");
    console.log("2. Contact your MCP service administrator for OAuth client_id");
    console.log("3. Check the MCP service documentation for alternative auth methods");
    console.log("\nYou can also manually get a token by:");
    console.log("- Using the ChatGPT MCP integration (if available)");
    console.log("- Contacting the #proj-gong-mcp Slack channel");
  }
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});

