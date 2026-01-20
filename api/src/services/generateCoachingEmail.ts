import pool from "../db/pool";
import { ClassifierDecision } from "./classifyCallEligibility";
import { generateCoachingFeedback } from "./openaiCoaching";
import { sendCoachingEmail } from "./sendEmail";

// Default strategy ID for backward compatibility
export const DEFAULT_STRATEGY_ID = "00000000-0000-0000-0000-000000000001";

export interface CallContext {
  call_title?: string;
  call_date?: string;
  external_emails?: string[];
  transcript?: string;
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

  // Fetch the active prompt for this strategy
  const promptResult = await pool.query(
    `SELECT body FROM public.prompts 
     WHERE strategy_id = $1 AND is_active = true 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [strategy_id]
  );

  const promptBody = promptResult.rows[0]?.body || "";
  
  // Check if we have a transcript to analyze
  const transcript = context?.transcript;
  
  let subject: string;
  let body: string;
  
  if (!transcript) {
    // No transcript available - use placeholder
    subject = "Your Coaching Feedback";
    body = "[No transcript available for this call - coaching feedback could not be generated]";
  } else if (!promptBody) {
    // No prompt configured - use placeholder
    subject = "Your Coaching Feedback";
    body = "[No coaching prompt configured for this strategy - please configure a prompt to enable AI coaching feedback]";
  } else {
    // Generate coaching feedback using OpenAI
    try {
      const coachingResult = await generateCoachingFeedback({
        prompt: promptBody,
        transcript,
        call_title: context?.call_title,
        call_date: context?.call_date,
        ae_email,
        external_emails: context?.external_emails,
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
        context ? JSON.stringify(context) : null,
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
