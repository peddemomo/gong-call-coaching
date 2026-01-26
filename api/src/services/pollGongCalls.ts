/**
 * Gong Polling Service
 *
 * Polls Gong for recent calls and processes them through the coaching pipeline.
 * Only processes calls for AEs in enabled strategies.
 */

import pool from "../db/pool";
import {
  getRecentCalls,
  getTranscriptByCallId,
  getInternalEmails,
  getExternalEmails,
  GongCallMetadata,
} from "../integrations/gong/client";
import { extractDomainFromEmail } from "../integrations/perplexity/client";
import { classifyCallEligibility } from "./classifyCallEligibility";
import { generateCoachingEmail } from "./generateCoachingEmail";

// Default polling window: look back 2 hours
const DEFAULT_LOOKBACK_HOURS = 2;

// Minimum call duration to process (in seconds) - skip very short calls
const MIN_CALL_DURATION_SECONDS = 120; // 2 minutes

export interface PollResult {
  callsFound: number;
  callsProcessed: number;
  callsSkipped: number;
  callsAlreadyProcessed: number;
  callsFailed: number;
  errors: string[];
  details: Array<{
    callId: string;
    callTitle: string;
    status: "processed" | "skipped" | "already_processed" | "failed";
    reason?: string;
    aeEmail?: string;
  }>;
}

/**
 * Poll Gong for recent calls and process them
 *
 * @param lookbackHours - How many hours back to look for calls (default: 2)
 * @returns Summary of what was processed
 */
export async function pollGongCalls(
  lookbackHours: number = DEFAULT_LOOKBACK_HOURS
): Promise<PollResult> {
  const result: PollResult = {
    callsFound: 0,
    callsProcessed: 0,
    callsSkipped: 0,
    callsAlreadyProcessed: 0,
    callsFailed: 0,
    errors: [],
    details: [],
  };

  try {
    // Calculate time range
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - lookbackHours * 60 * 60 * 1000);

    console.log(`[Poll] Starting poll for calls from ${fromDate.toISOString()} to ${toDate.toISOString()}`);

    // Fetch recent calls from Gong
    const calls = await getRecentCalls(fromDate.toISOString(), toDate.toISOString());
    result.callsFound = calls.length;

    if (calls.length === 0) {
      console.log(`[Poll] No calls found in the specified time range`);
      return result;
    }

    console.log(`[Poll] Found ${calls.length} calls to process`);

    // Process each call
    for (const call of calls) {
      try {
        await processCall(call, result);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Poll] Error processing call ${call.id}:`, errorMsg);
        result.callsFailed++;
        result.errors.push(`Call ${call.id}: ${errorMsg}`);
        result.details.push({
          callId: call.id,
          callTitle: call.title,
          status: "failed",
          reason: errorMsg,
        });
      }
    }

    console.log(
      `[Poll] Completed. Processed: ${result.callsProcessed}, Skipped: ${result.callsSkipped}, Already processed: ${result.callsAlreadyProcessed}, Failed: ${result.callsFailed}`
    );

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Poll] Fatal error:`, errorMsg);
    result.errors.push(`Fatal: ${errorMsg}`);
    return result;
  }
}

/**
 * Process a single call through the coaching pipeline
 */
async function processCall(call: GongCallMetadata, result: PollResult): Promise<void> {
  console.log(`[Poll] Processing call: ${call.id} - ${call.title}`);

  // Skip very short calls
  if (call.duration < MIN_CALL_DURATION_SECONDS) {
    console.log(`[Poll] Skipping call ${call.id}: too short (${call.duration}s)`);
    result.callsSkipped++;
    result.details.push({
      callId: call.id,
      callTitle: call.title,
      status: "skipped",
      reason: `Call too short (${call.duration}s < ${MIN_CALL_DURATION_SECONDS}s)`,
    });
    return;
  }

  // Get all internal participant emails (AE-first selection)
  const internalEmails = getInternalEmails(call.parties);
  if (internalEmails.length === 0) {
    console.log(`[Poll] Skipping call ${call.id}: no internal participant with email`);
    result.callsSkipped++;
    result.details.push({
      callId: call.id,
      callTitle: call.title,
      status: "skipped",
      reason: "No internal participant with email",
    });
    return;
  }

  // Look up which internal participants are configured AEs
  // This allows calls to be attributed to the AE even if a manager scheduled the meeting
  const aeResult = await pool.query(
    `SELECT a.id, a.email, a.strategy_id, s.enabled as strategy_enabled, s.name as strategy_name
     FROM public.aes a
     JOIN public.strategies s ON a.strategy_id = s.id
     WHERE a.email = ANY($1)`,
    [internalEmails]
  );

  if (aeResult.rows.length === 0) {
    console.log(`[Poll] Skipping call ${call.id}: no configured AE among internal participants (${internalEmails.join(", ")})`);
    result.callsSkipped++;
    result.details.push({
      callId: call.id,
      callTitle: call.title,
      status: "skipped",
      reason: `No configured AE among internal participants`,
    });
    return;
  }

  // Use the first configured AE found
  const ae = aeResult.rows[0];
  const aeEmail = ae.email;

  // Check if strategy is enabled
  if (!ae.strategy_enabled) {
    console.log(`[Poll] Skipping call ${call.id}: strategy "${ae.strategy_name}" is disabled`);
    result.callsSkipped++;
    result.details.push({
      callId: call.id,
      callTitle: call.title,
      status: "skipped",
      reason: `Strategy "${ae.strategy_name}" is disabled`,
      aeEmail,
    });
    return;
  }

  // Check if call already processed (for this strategy)
  const existingLog = await pool.query(
    `SELECT id FROM public.email_logs 
     WHERE gong_call_id = $1 AND strategy_id = $2 AND is_test = false`,
    [call.id, ae.strategy_id]
  );

  if (existingLog.rows.length > 0) {
    console.log(`[Poll] Skipping call ${call.id}: already processed`);
    result.callsAlreadyProcessed++;
    result.details.push({
      callId: call.id,
      callTitle: call.title,
      status: "already_processed",
      reason: "Already processed for this strategy",
      aeEmail,
    });
    return;
  }

  // Get external emails for domain deduplication check
  const externalEmails = getExternalEmails(call.parties);

  // Extract unique prospect domains from external emails
  const prospectDomains = [...new Set(
    externalEmails
      .map(email => extractDomainFromEmail(email))
      .filter((d): d is string => d !== null)
  )];

  // Check if we've already sent coaching for any of these prospect domains (for this AE/strategy)
  if (prospectDomains.length > 0) {
    const existingDomains = await pool.query(
      `SELECT prospect_domain FROM public.prospect_domain_sent 
       WHERE ae_email = $1 AND strategy_id = $2 AND prospect_domain = ANY($3)`,
      [aeEmail, ae.strategy_id, prospectDomains]
    );

    if (existingDomains.rows.length > 0) {
      const alreadyCoachedDomain = existingDomains.rows[0].prospect_domain;
      console.log(`[Poll] Skipping call ${call.id}: already coached for prospect domain "${alreadyCoachedDomain}"`);
      result.callsAlreadyProcessed++;
      result.details.push({
        callId: call.id,
        callTitle: call.title,
        status: "already_processed",
        reason: `Already coached for prospect domain: ${alreadyCoachedDomain}`,
        aeEmail,
      });
      return;
    }
  }

  // Fetch transcript
  console.log(`[Poll] Fetching transcript for call ${call.id}`);
  const transcript = await getTranscriptByCallId(call.id);

  if (!transcript) {
    console.log(`[Poll] Skipping call ${call.id}: no transcript available`);
    result.callsSkipped++;
    result.details.push({
      callId: call.id,
      callTitle: call.title,
      status: "skipped",
      reason: "No transcript available",
      aeEmail,
    });
    return;
  }

  // Run classifier
  console.log(`[Poll] Classifying call ${call.id}`);
  const decision = await classifyCallEligibility({
    call_title: call.title,
    external_emails: externalEmails,
    transcript,
  });

  // Build context
  const context = {
    call_title: call.title,
    call_date: call.started,
    external_emails: externalEmails,
    transcript,
  };

  // If classifier says skip, log it and continue
  if (!decision.should_send) {
    console.log(`[Poll] Call ${call.id} classified as non-eligible: ${decision.reason}`);
    await generateCoachingEmail({
      ae_email: aeEmail,
      gong_call_id: call.id,
      strategy_id: ae.strategy_id,
      context,
      decision,
      skipped: true,
      skip_reason: decision.reason,
      is_test: false,
    });
    result.callsSkipped++;
    result.details.push({
      callId: call.id,
      callTitle: call.title,
      status: "skipped",
      reason: decision.reason,
      aeEmail,
    });
    return;
  }

  // Generate and send coaching email
  console.log(`[Poll] Generating coaching email for call ${call.id}`);
  const emailLog = await generateCoachingEmail({
    ae_email: aeEmail,
    gong_call_id: call.id,
    strategy_id: ae.strategy_id,
    context,
    decision,
    is_test: false,
  });

  // Record prospect domains for deduplication (only if we have valid domains)
  if (prospectDomains.length > 0) {
    for (const domain of prospectDomains) {
      try {
        await pool.query(
          `INSERT INTO public.prospect_domain_sent (ae_email, prospect_domain, strategy_id, first_email_log_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (ae_email, prospect_domain, strategy_id) DO NOTHING`,
          [aeEmail, domain, ae.strategy_id, emailLog.id]
        );
      } catch (domainError) {
        // Log but don't fail the overall process - the email was already sent
        console.error(`[Poll] Failed to record prospect domain ${domain}:`, domainError);
      }
    }
    console.log(`[Poll] Recorded ${prospectDomains.length} prospect domain(s) for deduplication: ${prospectDomains.join(", ")}`);
  }

  console.log(`[Poll] Successfully processed call ${call.id}`);
  result.callsProcessed++;
  result.details.push({
    callId: call.id,
    callTitle: call.title,
    status: "processed",
    aeEmail,
  });
}

/**
 * Start background polling at a specified interval
 *
 * @param intervalMinutes - How often to poll (default: 15 minutes)
 * @param lookbackHours - How far back to look each poll (default: 2 hours)
 * @returns Function to stop the polling
 */
export function startPolling(
  intervalMinutes: number = 15,
  lookbackHours: number = DEFAULT_LOOKBACK_HOURS
): () => void {
  console.log(
    `[Poll] Starting background polling every ${intervalMinutes} minutes, looking back ${lookbackHours} hours`
  );

  // Run immediately on start
  pollGongCalls(lookbackHours).catch((err) => {
    console.error("[Poll] Error in initial poll:", err);
  });

  // Then run on interval
  const intervalId = setInterval(() => {
    pollGongCalls(lookbackHours).catch((err) => {
      console.error("[Poll] Error in scheduled poll:", err);
    });
  }, intervalMinutes * 60 * 1000);

  // Return stop function
  return () => {
    console.log("[Poll] Stopping background polling");
    clearInterval(intervalId);
  };
}
