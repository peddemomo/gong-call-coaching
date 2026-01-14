import pool from "../db/pool";
import { ClassifierDecision } from "./classifyCallEligibility";

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

  // TODO: Fetch the active prompt and use it with OpenAI
  // For now, generate a placeholder that simulates AI coaching output

  const subject = `Your Coaching Feedback`;
  const body = `[Placeholder - AI coaching feedback will appear here]

This is where the AI-generated coaching feedback will be displayed based on the Gong call transcript.

The actual implementation will:
1. Fetch the call transcript from Gong
2. Send it to ChatGPT with your configured prompt
3. Return personalized coaching feedback`;

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

    return result.rows[0];
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
