/**
 * Company Context Service
 * 
 * Fetches and caches company context information for prospect domains.
 * Uses Perplexity API for web-grounded company research.
 */

import pool from "../db/pool";
import {
  searchCompanyContext,
  extractDomainFromEmail,
  CompanyContext,
} from "../integrations/perplexity/client";

interface CachedContext {
  domain: string;
  context: CompanyContext;
  fetched_at: string;
  expires_at: string;
}

/**
 * Get company context for a domain, using cache when available.
 * 
 * @param domain - Company domain (e.g., "acme.com")
 * @returns Company context or null if fetch fails
 */
export async function getCompanyContext(domain: string): Promise<CompanyContext | null> {
  // Check cache first
  const cached = await getCachedContext(domain);
  if (cached) {
    console.log(`[CompanyContext] Cache hit for: ${domain}`);
    return cached;
  }

  // Fetch from Perplexity
  try {
    const context = await searchCompanyContext(domain);
    
    // Cache the result
    await cacheContext(context);
    
    return context;
  } catch (error) {
    console.error(`[CompanyContext] Failed to fetch context for ${domain}:`, error);
    return null;
  }
}

/**
 * Get company context from external participant emails.
 * Extracts domain from the first valid external email and fetches context.
 * 
 * @param externalEmails - Array of external participant emails
 * @returns Company context or null if no valid domain found
 */
export async function getCompanyContextFromEmails(
  externalEmails?: string[]
): Promise<CompanyContext | null> {
  if (!externalEmails || externalEmails.length === 0) {
    return null;
  }

  // Try each email until we find a valid domain
  for (const email of externalEmails) {
    const domain = extractDomainFromEmail(email);
    if (domain) {
      return getCompanyContext(domain);
    }
  }

  console.log(`[CompanyContext] No valid company domain found in external emails`);
  return null;
}

/**
 * Check if we have a valid cached context for a domain
 */
async function getCachedContext(domain: string): Promise<CompanyContext | null> {
  try {
    const result = await pool.query(
      `SELECT domain, context, fetched_at, expires_at
       FROM public.company_context_cache
       WHERE domain = $1 AND expires_at > NOW()`,
      [domain]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row: CachedContext = result.rows[0];
    return row.context;
  } catch (error) {
    console.error(`[CompanyContext] Cache lookup failed for ${domain}:`, error);
    return null;
  }
}

/**
 * Cache a company context result
 */
async function cacheContext(context: CompanyContext): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO public.company_context_cache (domain, context, fetched_at, expires_at)
       VALUES ($1, $2, NOW(), NOW() + INTERVAL '7 days')
       ON CONFLICT (domain) 
       DO UPDATE SET context = $2, fetched_at = NOW(), expires_at = NOW() + INTERVAL '7 days'`,
      [context.domain, JSON.stringify(context)]
    );
    console.log(`[CompanyContext] Cached context for: ${context.domain}`);
  } catch (error) {
    console.error(`[CompanyContext] Failed to cache context for ${context.domain}:`, error);
    // Don't throw - caching failure shouldn't break the flow
  }
}

/**
 * Clean up expired cache entries (can be run periodically)
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const result = await pool.query(
      `DELETE FROM public.company_context_cache WHERE expires_at < NOW()`
    );
    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      console.log(`[CompanyContext] Cleaned up ${deletedCount} expired cache entries`);
    }
    return deletedCount;
  } catch (error) {
    console.error(`[CompanyContext] Cache cleanup failed:`, error);
    return 0;
  }
}
