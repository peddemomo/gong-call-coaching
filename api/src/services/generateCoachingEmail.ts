import pool from "../db/pool";

// Default strategy ID for backward compatibility
export const DEFAULT_STRATEGY_ID = "00000000-0000-0000-0000-000000000001";

export interface GenerateEmailInput {
  ae_email: string;
  gong_call_id: string;
  strategy_id?: string;
}

export interface EmailLogRow {
  id: number;
  ae_email: string;
  gong_call_id: string;
  status: string;
  subject: string;
  body: string;
  error_message: string | null;
  created_at: string;
  strategy_id: string;
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
  const { ae_email, gong_call_id, strategy_id = DEFAULT_STRATEGY_ID } = input;

  // TODO: Fetch the active prompt and use it with OpenAI
  // For now, generate a placeholder that simulates AI coaching output

  const subject = `Your Coaching Feedback`;
  const body = `[Placeholder - AI coaching feedback will appear here]

This is where the AI-generated coaching feedback will be displayed based on the Gong call transcript.

The actual implementation will:
1. Fetch the call transcript from Gong
2. Send it to ChatGPT with your configured prompt
3. Return personalized coaching feedback`;

  // Insert into email_logs with idempotency check
  try {
    const result = await pool.query(
      `INSERT INTO public.email_logs (ae_email, gong_call_id, status, subject, body, error_message, strategy_id, created_at)
       VALUES ($1, $2, 'queued', $3, $4, NULL, $5, NOW())
       RETURNING *`,
      [ae_email, gong_call_id, subject, body, strategy_id]
    );

    return result.rows[0];
  } catch (error: unknown) {
    // Check for unique constraint violation (PostgreSQL error code 23505)
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      throw new DuplicateEmailError(
        `Already generated for this AE and call: ${ae_email}, ${gong_call_id}`
      );
    }
    throw error;
  }
}
