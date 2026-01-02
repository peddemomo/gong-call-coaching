import pool from "../db/pool";

export interface GenerateEmailInput {
  ae_email: string;
  gong_call_id: string;
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
  const { ae_email, gong_call_id } = input;

  // Fetch the active prompt
  const promptResult = await pool.query(
    `SELECT body FROM public.prompts 
     WHERE is_active = true 
     ORDER BY created_at DESC 
     LIMIT 1`
  );

  const promptBody =
    promptResult.rows.length > 0 ? promptResult.rows[0].body : "(No active prompt configured)";

  // Build the generated email (placeholder for now)
  const subject = `Coaching: ${ae_email} – ${gong_call_id}`;
  const body = `Subject: Coaching for ${ae_email}

Prompt:
${promptBody}

Call ID: ${gong_call_id}

(Placeholder: will use Gong transcript later)`;

  // Insert into email_logs with idempotency check
  try {
    const result = await pool.query(
      `INSERT INTO public.email_logs (ae_email, gong_call_id, status, subject, body, error_message, created_at)
       VALUES ($1, $2, 'queued', $3, $4, NULL, NOW())
       RETURNING *`,
      [ae_email, gong_call_id, subject, body]
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

