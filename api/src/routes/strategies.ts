import { Router, Request, Response } from "express";
import { z } from "zod";
import pool from "../db/pool";
import {
  generateCoachingEmail,
  DuplicateEmailError,
} from "../services/generateCoachingEmail";
import { classifyCallEligibility } from "../services/classifyCallEligibility";
import {
  getCallById,
  getTranscriptByCallId,
  getInternalEmails,
  getExternalEmails,
  getExternalSpeakerNames,
} from "../integrations/gong/client";

const router = Router();

// Default strategy ID for backward compatibility
export const DEFAULT_STRATEGY_ID = "00000000-0000-0000-0000-000000000001";

// Validation schemas
const createStrategySchema = z.object({
  name: z.string().min(1, "Strategy name is required"),
});

const createAESchema = z.object({
  email: z.string().email("Invalid email address"),
});

const updatePromptSchema = z.object({
  body: z.string().min(1, "Prompt body cannot be empty"),
});

const generateRequestSchema = z.object({
  ae_email: z.string().email("Invalid email address"),
  gong_call_id: z.string().min(1, "Gong call ID is required"),
  call_title: z.string().optional(),
  call_date: z.string().optional(),
  external_emails: z.array(z.string().email()).optional(),
  external_speaker_names: z.array(z.string()).optional(),
  transcript: z.string().optional(),
});

const moveAESchema = z.object({
  strategy_id: z.string().uuid("Invalid strategy ID"),
});

const testCallSchema = z.object({
  gong_call_id: z.string().min(1, "Gong call ID is required"),
  test_email: z.string().email("Invalid test email address").optional(),
});

// GET /strategies - List all strategies
router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM public.strategies ORDER BY created_at ASC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching strategies:", error);
    res.status(500).json({ error: "Failed to fetch strategies" });
  }
});

// POST /strategies - Create a new strategy
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = createStrategySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors,
      });
      return;
    }

    const { name } = parsed.data;

    const result = await pool.query(
      `INSERT INTO public.strategies (name, created_at)
       VALUES ($1, NOW())
       RETURNING *`,
      [name]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating strategy:", error);
    res.status(500).json({ error: "Failed to create strategy" });
  }
});

// PATCH /strategies/:strategyId - Update a strategy's name
router.patch("/:strategyId", async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const parsed = createStrategySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors,
      });
      return;
    }

    const { name } = parsed.data;

    const result = await pool.query(
      `UPDATE public.strategies 
       SET name = $1 
       WHERE id = $2 
       RETURNING *`,
      [name, strategyId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Strategy not found" });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating strategy:", error);
    res.status(500).json({ error: "Failed to update strategy" });
  }
});

// PATCH /strategies/:strategyId/toggle - Toggle a strategy's enabled status
router.patch("/:strategyId/toggle", async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;

    const result = await pool.query(
      `UPDATE public.strategies 
       SET enabled = NOT enabled 
       WHERE id = $1 
       RETURNING *`,
      [strategyId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Strategy not found" });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error toggling strategy:", error);
    res.status(500).json({ error: "Failed to toggle strategy" });
  }
});

// DELETE /strategies/:strategyId - Delete a strategy
router.delete("/:strategyId", async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;

    // Don't allow deleting the default strategy
    if (strategyId === DEFAULT_STRATEGY_ID) {
      res.status(400).json({ error: "Cannot delete the default strategy" });
      return;
    }

    // Check if strategy has any AEs
    const aeCheck = await pool.query(
      "SELECT COUNT(*) FROM public.aes WHERE strategy_id = $1",
      [strategyId]
    );

    if (parseInt(aeCheck.rows[0].count) > 0) {
      res.status(400).json({ 
        error: "Cannot delete strategy with recipients. Remove all recipients first." 
      });
      return;
    }

    const result = await pool.query(
      "DELETE FROM public.strategies WHERE id = $1 RETURNING id",
      [strategyId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Strategy not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting strategy:", error);
    res.status(500).json({ error: "Failed to delete strategy" });
  }
});

// GET /strategies/:strategyId/aes - List AEs for a strategy
router.get("/:strategyId/aes", async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;

    const result = await pool.query(
      `SELECT * FROM public.aes 
       WHERE strategy_id = $1 
       ORDER BY created_at DESC`,
      [strategyId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching AEs for strategy:", error);
    res.status(500).json({ error: "Failed to fetch AEs" });
  }
});

// POST /strategies/:strategyId/aes - Create AE in a strategy
// Returns 409 if AE email already exists in ANY strategy (global uniqueness)
router.post("/:strategyId/aes", async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const parsed = createAESchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors,
      });
      return;
    }

    const { email } = parsed.data;

    // Verify strategy exists
    const strategyCheck = await pool.query(
      "SELECT id, name FROM public.strategies WHERE id = $1",
      [strategyId]
    );

    if (strategyCheck.rows.length === 0) {
      res.status(404).json({ error: "Strategy not found" });
      return;
    }

    // Check if AE already exists globally (in any strategy)
    const existingAE = await pool.query(
      `SELECT a.id, a.email, a.strategy_id, s.name as strategy_name
       FROM public.aes a
       JOIN public.strategies s ON a.strategy_id = s.id
       WHERE a.email = $1`,
      [email]
    );

    if (existingAE.rows.length > 0) {
      const existing = existingAE.rows[0];
      res.status(409).json({
        error: "AE already assigned to another strategy",
        existing_strategy_id: existing.strategy_id,
        existing_strategy_name: existing.strategy_name,
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO public.aes (email, enabled, strategy_id, created_at)
       VALUES ($1, true, $2, NOW())
       RETURNING *`,
      [email, strategyId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: unknown) {
    // Fallback for unique constraint violation (race condition)
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      res.status(409).json({ error: "AE already assigned to another strategy" });
      return;
    }
    console.error("Error creating AE:", error);
    res.status(500).json({ error: "Failed to create AE" });
  }
});

// DELETE /strategies/:strategyId/aes/:aeId - Delete an AE from a strategy
router.delete("/:strategyId/aes/:aeId", async (req: Request, res: Response) => {
  try {
    const { strategyId, aeId } = req.params;

    // Verify AE exists and belongs to this strategy
    const aeCheck = await pool.query(
      "SELECT id, email, strategy_id FROM public.aes WHERE id = $1",
      [aeId]
    );

    if (aeCheck.rows.length === 0) {
      res.status(404).json({ error: "AE not found" });
      return;
    }

    const ae = aeCheck.rows[0];
    if (ae.strategy_id !== strategyId) {
      res.status(404).json({ error: "AE not found in this strategy" });
      return;
    }

    // Delete the AE
    await pool.query("DELETE FROM public.aes WHERE id = $1", [aeId]);

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting AE:", error);
    res.status(500).json({ error: "Failed to delete AE" });
  }
});

// PATCH /aes/:aeId/move - Move an AE to a different strategy (admin action)
router.patch("/aes/:aeId/move", async (req: Request, res: Response) => {
  try {
    const { aeId } = req.params;
    const parsed = moveAESchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors,
      });
      return;
    }

    const { strategy_id: newStrategyId } = parsed.data;

    // Verify AE exists
    const aeCheck = await pool.query(
      "SELECT id, email, strategy_id FROM public.aes WHERE id = $1",
      [aeId]
    );

    if (aeCheck.rows.length === 0) {
      res.status(404).json({ error: "AE not found" });
      return;
    }

    // Verify new strategy exists
    const strategyCheck = await pool.query(
      "SELECT id, name FROM public.strategies WHERE id = $1",
      [newStrategyId]
    );

    if (strategyCheck.rows.length === 0) {
      res.status(404).json({ error: "Target strategy not found" });
      return;
    }

    // Update AE's strategy
    const result = await pool.query(
      `UPDATE public.aes 
       SET strategy_id = $1 
       WHERE id = $2 
       RETURNING *`,
      [newStrategyId, aeId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error moving AE:", error);
    res.status(500).json({ error: "Failed to move AE" });
  }
});

// GET /strategies/:strategyId/prompt - Get active prompt for a strategy
router.get("/:strategyId/prompt", async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;

    const result = await pool.query(
      `SELECT * FROM public.prompts 
       WHERE strategy_id = $1 AND is_active = true 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [strategyId]
    );

    if (result.rows.length === 0) {
      res.json({ body: "", is_active: true, strategy_id: strategyId });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching prompt for strategy:", error);
    res.status(500).json({ error: "Failed to fetch prompt" });
  }
});

// PUT /strategies/:strategyId/prompt - Set active prompt for a strategy
router.put("/:strategyId/prompt", async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const parsed = updatePromptSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors,
      });
      return;
    }

    const { body } = parsed.data;

    // Verify strategy exists
    const strategyCheck = await pool.query(
      "SELECT id FROM public.strategies WHERE id = $1",
      [strategyId]
    );

    if (strategyCheck.rows.length === 0) {
      res.status(404).json({ error: "Strategy not found" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Deactivate all existing prompts for this strategy only
      await client.query(
        "UPDATE public.prompts SET is_active = false WHERE strategy_id = $1",
        [strategyId]
      );

      // Insert new active prompt
      const result = await client.query(
        `INSERT INTO public.prompts (body, is_active, strategy_id, created_at)
         VALUES ($1, true, $2, NOW())
         RETURNING *`,
        [body, strategyId]
      );

      await client.query("COMMIT");

      res.status(200).json(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error updating prompt for strategy:", error);
    res.status(500).json({ error: "Failed to update prompt" });
  }
});

// GET /strategies/:strategyId/email-logs - List email logs for a strategy
router.get("/:strategyId/email-logs", async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;

    const result = await pool.query(
      `SELECT id, ae_email, gong_call_id, status, subject, body, error_message, created_at, strategy_id, context, decision, skip_reason, is_test, test_run_id, value_point_evaluations
       FROM public.email_logs
       WHERE strategy_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [strategyId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching email logs for strategy:", error);
    res.status(500).json({ error: "Failed to fetch email logs" });
  }
});

// POST /strategies/:strategyId/generate - Generate email for an AE in a strategy
router.post("/:strategyId/generate", async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const parsed = generateRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors,
      });
      return;
    }

    const { ae_email, gong_call_id, call_title, call_date, external_emails, external_speaker_names, transcript } = parsed.data;

    // Verify strategy exists
    const strategyCheck = await pool.query(
      "SELECT id FROM public.strategies WHERE id = $1",
      [strategyId]
    );

    if (strategyCheck.rows.length === 0) {
      res.status(404).json({ error: "Strategy not found" });
      return;
    }

    // Verify AE exists in this strategy
    const aeCheck = await pool.query(
      "SELECT id FROM public.aes WHERE email = $1 AND strategy_id = $2",
      [ae_email, strategyId]
    );

    if (aeCheck.rows.length === 0) {
      res.status(400).json({ 
        error: "AE not found in this strategy",
        message: `The AE "${ae_email}" is not assigned to this strategy. Add them first or use the correct strategy.`
      });
      return;
    }

    // Run the classifier to determine if this call should receive coaching
    const decision = await classifyCallEligibility({
      call_title,
      external_emails,
      transcript,
    });

    // Build context object (include transcript for reference)
    const context = (call_title || call_date || external_emails || external_speaker_names || transcript)
      ? { call_title, call_date, external_emails, external_speaker_names, transcript }
      : undefined;

    // If classifier says skip, insert a skipped record and return
    if (!decision.should_send) {
      const emailLog = await generateCoachingEmail({
        ae_email,
        gong_call_id,
        strategy_id: strategyId,
        context,
        decision,
        skipped: true,
        skip_reason: decision.reason,
      });

      res.status(200).json({ 
        skipped: true, 
        reason: decision.reason, 
        decision,
        email_log: emailLog,
      });
      return;
    }

    // Proceed with generation
    const emailLog = await generateCoachingEmail({
      ae_email,
      gong_call_id,
      strategy_id: strategyId,
      context,
      decision,
    });

    res.status(201).json(emailLog);
  } catch (error: unknown) {
    if (error instanceof DuplicateEmailError) {
      res.status(409).json({ error: error.message });
      return;
    }

    console.error("Error generating coaching email:", error);
    res.status(500).json({ error: "Failed to generate coaching email" });
  }
});

// POST /strategies/:strategyId/test-call - Run a test call through the full pipeline (never sends email)
router.post("/:strategyId/test-call", async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;
    const parsed = testCallSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors,
      });
      return;
    }

    const { gong_call_id, test_email } = parsed.data;

    // Verify strategy exists
    const strategyCheck = await pool.query(
      "SELECT id, name FROM public.strategies WHERE id = $1",
      [strategyId]
    );

    if (strategyCheck.rows.length === 0) {
      res.status(404).json({ error: "Strategy not found" });
      return;
    }

    // Step 1: Fetch call metadata + transcript from Gong
    let callMetadata;
    let transcript;
    try {
      callMetadata = await getCallById(gong_call_id);
      transcript = await getTranscriptByCallId(gong_call_id);
    } catch (gongError) {
      const message = gongError instanceof Error ? gongError.message : "Unknown Gong API error";
      res.status(400).json({
        error: "Failed to fetch call from Gong",
        details: message,
      });
      return;
    }

    // Step 2: Get all internal participant emails (AE-first selection)
    const internalEmails = getInternalEmails(callMetadata.parties);

    if (internalEmails.length === 0) {
      res.status(200).json({
        skipped: true,
        reason: "No internal participant found in call",
        gong_call_id,
        call_title: callMetadata.title,
      });
      return;
    }

    // Step 3: Check which internal participants are configured AEs in this strategy
    // This allows calls to be attributed to the AE even if a manager scheduled the meeting
    const aeCheck = await pool.query(
      "SELECT id, email, strategy_id FROM public.aes WHERE email = ANY($1) AND strategy_id = $2",
      [internalEmails, strategyId]
    );

    if (aeCheck.rows.length === 0) {
      // Check if any of them are AEs in a different strategy
      const otherStrategyCheck = await pool.query(
        "SELECT email, strategy_id FROM public.aes WHERE email = ANY($1)",
        [internalEmails]
      );

      if (otherStrategyCheck.rows.length > 0) {
        const otherAE = otherStrategyCheck.rows[0];
        res.status(200).json({
          skipped: true,
          reason: "AE belongs to different strategy",
          ae_email: otherAE.email,
          current_strategy_id: otherAE.strategy_id,
          gong_call_id,
          call_title: callMetadata.title,
        });
        return;
      }

      res.status(200).json({
        skipped: true,
        reason: "No configured AE among internal participants",
        internal_participants: internalEmails,
        gong_call_id,
        call_title: callMetadata.title,
      });
      return;
    }

    // Use the first configured AE found in this strategy
    const aeRecord = aeCheck.rows[0];
    const ae_email = aeRecord.email;

    // Step 4: Build input object for classifier
    const external_emails = getExternalEmails(callMetadata.parties);
    const call_title = callMetadata.title;
    const call_date = callMetadata.started;

    // Step 5: Run classifyCallEligibility
    const decision = await classifyCallEligibility({
      call_title,
      external_emails,
      transcript,
    });

    // Build context object (include external speaker names for value-point insights)
    const external_speaker_names = getExternalSpeakerNames(callMetadata.parties);
    const context = {
      call_title,
      call_date,
      external_emails,
      external_speaker_names: external_speaker_names.length > 0 ? external_speaker_names : undefined,
      transcript,
    };

    // Step 6: Handle based on classifier decision
    if (!decision.should_send) {
      // Insert skipped test row
      const emailLog = await generateCoachingEmail({
        ae_email,
        gong_call_id,
        strategy_id: strategyId,
        context,
        decision,
        skipped: true,
        skip_reason: decision.reason,
        is_test: true,
        test_email_override: test_email,
      });

      res.status(200).json({
        skipped: true,
        reason: decision.reason,
        decision,
        ae_email,
        email_log: emailLog,
      });
      return;
    }

    // Step 7: Generate output and send to test email if provided
    const emailLog = await generateCoachingEmail({
      ae_email,
      gong_call_id,
      strategy_id: strategyId,
      context,
      decision,
      is_test: true,
      test_email_override: test_email,
    });

    res.status(201).json(emailLog);
  } catch (error) {
    console.error("Error running test call:", error);
    res.status(500).json({ error: "Failed to run test call" });
  }
});

export default router;
