/**
 * Perplexity API Client
 * 
 * Uses Perplexity's sonar model to search the web and generate
 * company context summaries from prospect domains.
 */

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";

export interface CompanyContext {
  domain: string;
  summary: string;
  industry?: string;
  products?: string;
  target_customers?: string;
  fetched_at: string;
}

interface PerplexityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
}

/**
 * Search for company information using Perplexity's web-grounded AI
 * 
 * @param domain - The company domain (e.g., "acme.com")
 * @returns Company context with summary and metadata
 */
export async function searchCompanyContext(domain: string): Promise<CompanyContext> {
  if (!PERPLEXITY_API_KEY) {
    throw new Error(
      "Missing Perplexity API key. Set PERPLEXITY_API_KEY environment variable."
    );
  }

  // Extract company name from domain (remove TLD)
  const companyName = domain.split(".")[0];

  const systemPrompt = `You are a business research assistant. Provide detailed, factual information about companies based on their website and public information. Your research will be used to match against sales enablement criteria, so be thorough about the company's products, capabilities, and the problems they solve.`;

  const userPrompt = `Research the company at ${domain} (${companyName}). Provide a detailed summary covering:

1. **Company overview**: What the company does and their mission (2-3 sentences)
2. **Products and services**: Describe each major product or service they offer. What does it do? What specific capabilities or features does it have?
3. **Problems they solve**: What pain points or challenges do their products address? What outcomes or results do they claim to deliver for their customers?
4. **Target customers and industry**: Who are their buyers? What verticals or segments do they serve?
5. **Technology and platform**: Any notable technology, integrations, or platform details mentioned on their site
6. **Recent news and initiatives**: Any recent product launches, partnerships, funding, strategic shifts, or public announcements

Be specific and detailed — include product names, feature descriptions, and claimed outcomes when available. Do not summarize generically; the more specific detail you include about what their products do and what results they deliver, the better. If you cannot find information about this company, say so clearly.`;

  const messages: PerplexityMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  console.log(`[Perplexity] Searching for company context: ${domain}`);

  const response = await fetch(`${PERPLEXITY_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages,
      max_tokens: 1500,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Perplexity] API error (${response.status}):`, errorText);
    throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
  }

  const data: PerplexityResponse = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Perplexity returned an empty response");
  }

  console.log(`[Perplexity] Successfully fetched context for: ${domain}`);

  return {
    domain,
    summary: content,
    fetched_at: new Date().toISOString(),
  };
}

/**
 * List of common email domains that should be skipped
 * (personal email providers, not company domains)
 */
export const COMMON_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "fastmail.com",
  "tutanota.com",
]);

/**
 * Extract domain from an email address
 * 
 * @param email - Email address (e.g., "john@acme.com")
 * @returns Domain (e.g., "acme.com") or null if invalid/common domain
 */
export function extractDomainFromEmail(email: string): string | null {
  if (!email || !email.includes("@")) {
    return null;
  }

  const domain = email.split("@")[1]?.toLowerCase();
  
  if (!domain) {
    return null;
  }

  // Skip common personal email domains
  if (COMMON_EMAIL_DOMAINS.has(domain)) {
    return null;
  }

  return domain;
}
