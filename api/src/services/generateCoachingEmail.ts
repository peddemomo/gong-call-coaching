import pool from "../db/pool";
import { ClassifierDecision } from "./classifyCallEligibility";
import { generateCoachingFeedback } from "./openaiCoaching";
import { sendCoachingEmail } from "./sendEmail";
import { getCompanyContextFromEmails } from "./companyContext";

// Default strategy ID for backward compatibility
export const DEFAULT_STRATEGY_ID = "00000000-0000-0000-0000-000000000001";

export interface CallContext {
  call_title?: string;
  call_date?: string;
  external_emails?: string[];
  external_speaker_names?: string[];
  transcript?: string;
  company_context?: string;
}

export interface GenerateEmailInput {
  ae_email: string;
  gong_call_id: string;
  strategy_id?: string;
  context?: CallContext;
  decision?: ClassifierDecision;
  skipped?: boolean;
  skip_reason?: string;
  is_test?: boolean;
}

export interface EmailLogRow {
  id: number;
  ae_email: string;
  gong_call_id: string;
  status: string;
  subject: string | null;
  body: string | null;
  error_message: string | null;
  created_at: string;
  strategy_id: string;
  context: CallContext | null;
  decision: ClassifierDecision | null;
  skip_reason: string | null;
  is_test: boolean;
  test_run_id: string;
}

export class DuplicateEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateEmailError";
  }
}

export async function generateCoachingEmail(
  input: GenerateEmailInput
): Promise<EmailLogRow> {
  const { 
    ae_email, 
    gong_call_id, 
    strategy_id = DEFAULT_STRATEGY_ID, 
    context,
    decision,
    skipped,
    skip_reason,
    is_test = false,
  } = input;

  // Handle skipped calls
  if (skipped) {
    try {
      const result = await pool.query(
        `INSERT INTO public.email_logs (ae_email, gong_call_id, status, subject, body, error_message, strategy_id, context, decision, skip_reason, is_test, created_at)
         VALUES ($1, $2, 'skipped', NULL, NULL, NULL, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [
          ae_email, 
          gong_call_id, 
          strategy_id, 
          context ? JSON.stringify(context) : null,
          decision ? JSON.stringify(decision) : null,
          skip_reason || null,
          is_test,
        ]
      );
      return result.rows[0];
    } catch (error: unknown) {
      // For test runs, we don't throw duplicate errors since they're allowed to repeat
      if (
        !is_test &&
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        throw new DuplicateEmailError("Already processed for this call");
      }
      if (!is_test) throw error;
      // If it's a test and somehow still fails, re-throw
      throw error;
    }
  }

  // Fetch products and value points for this strategy via junction table
  const productsResult = await pool.query(
    `SELECT p.id, p.title, p.description
     FROM public.products p
     JOIN public.strategy_products sp ON sp.product_id = p.id
     WHERE sp.strategy_id = $1
     ORDER BY p.created_at ASC`,
    [strategy_id]
  );
  const productRows = productsResult.rows as { id: string; title: string; description: string | null }[];
  const productValuePoints: { productTitle: string; productDescription?: string; valuePoints: { listen_for: string; insight_text: string; link?: string }[] }[] = [];
  for (const p of productRows) {
    const vpResult = await pool.query(
      `SELECT listen_for, insight_text, link FROM public.product_value_points WHERE product_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [p.id]
    );
    productValuePoints.push({
      productTitle: p.title,
      productDescription: p.description ?? undefined,
      valuePoints: vpResult.rows as { listen_for: string; insight_text: string; link?: string }[],
    });
  }
  
  // Check if we have a transcript to analyze
  const transcript = context?.transcript;
  
  // Fetch company context from external participant emails
  let companyContextSummary: string | undefined;
  if (context?.external_emails && context.external_emails.length > 0) {
    try {
      const companyContext = await getCompanyContextFromEmails(context.external_emails);
      if (companyContext) {
        companyContextSummary = companyContext.summary;
        console.log(`[Email] Fetched company context for domain: ${companyContext.domain}`);
      }
    } catch (error) {
      console.error("[Email] Failed to fetch company context:", error);
      // Continue without company context - it's not critical
    }
  }
  
  let subject: string;
  let body: string;
  
  if (!transcript) {
    // No transcript available - use placeholder
    subject = "Your Coaching Feedback";
    body = "[No transcript available for this call - coaching feedback could not be generated]";
  } else {
    // Generate coaching feedback using OpenAI
    try {
      const coachingResult = await generateCoachingFeedback({
        transcript,
        call_title: context?.call_title,
        call_date: context?.call_date,
        ae_email,
        external_emails: context?.external_emails,
        external_speaker_names: context?.external_speaker_names,
        company_context: companyContextSummary,
        product_value_points: productValuePoints,
      });
      
      subject = coachingResult.subject;
      body = coachingResult.body;
    } catch (error) {
      console.error("[OpenAI] Error generating coaching feedback:", error);
      subject = "Your Coaching Feedback";
      body = `[Error generating coaching feedback: ${error instanceof Error ? error.message : "Unknown error"}]`;
    }
  }

  // For test runs, use 'generated' status instead of 'queued' since we won't actually queue
  const status = is_test ? "generated" : "queued";

  // Build context with company context included for logging
  const contextToStore: CallContext | undefined = context 
    ? { ...context, company_context: companyContextSummary }
    : companyContextSummary 
      ? { company_context: companyContextSummary }
      : undefined;

  // Insert into email_logs with idempotency check (only for non-test runs)
  try {
    const result = await pool.query(
      `INSERT INTO public.email_logs (ae_email, gong_call_id, status, subject, body, error_message, strategy_id, context, decision, skip_reason, is_test, created_at)
       VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, NULL, $9, NOW())
       RETURNING *`,
      [
        ae_email, 
        gong_call_id, 
        status,
        subject, 
        body, 
        strategy_id, 
        contextToStore ? JSON.stringify(contextToStore) : null,
        decision ? JSON.stringify(decision) : null,
        is_test,
      ]
    );

    const emailLog = result.rows[0];

    // Send the email (including test runs - they go to the hardcoded test email anyway)
    if (body) {
      try {
        const callTitle = context?.call_title || "Gong call";
        const emailResult = await sendCoachingEmail({
          recipientEmail: ae_email,
          callTitle,
          coachingBody: body,
          subject,
        });

        if (emailResult.success) {
          // Update status to 'sent'
          await pool.query(
            `UPDATE public.email_logs SET status = 'sent' WHERE id = $1`,
            [emailLog.id]
          );
          emailLog.status = "sent";
          console.log(`[Email] Successfully sent for call ${gong_call_id} to test email`);
        } else {
          // Update status to 'failed' with error message
          await pool.query(
            `UPDATE public.email_logs SET status = 'failed', error_message = $2 WHERE id = $1`,
            [emailLog.id, emailResult.error]
          );
          emailLog.status = "failed";
          emailLog.error_message = emailResult.error;
          console.error(`[Email] Failed to send for call ${gong_call_id}: ${emailResult.error}`);
        }
      } catch (emailError) {
        // Update status to 'failed' with error message
        const errorMsg = emailError instanceof Error ? emailError.message : "Unknown email error";
        await pool.query(
          `UPDATE public.email_logs SET status = 'failed', error_message = $2 WHERE id = $1`,
          [emailLog.id, errorMsg]
        );
        emailLog.status = "failed";
        emailLog.error_message = errorMsg;
        console.error(`[Email] Error sending for call ${gong_call_id}:`, emailError);
      }
    }

    return emailLog;
  } catch (error: unknown) {
    // Check for unique constraint violation (PostgreSQL error code 23505)
    // Test runs are allowed to repeat, so only throw for non-test runs
    if (
      !is_test &&
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      throw new DuplicateEmailError("Already generated for this call");
    }
    throw error;
  }
}
