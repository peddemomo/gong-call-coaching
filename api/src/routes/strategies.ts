import { Router, Request, Response } from "express";
import { z } from "zod";
import pool from "../db/pool";
import {
  generateCoachingEmail,
  DuplicateEmailError,
} from "../services/generateCoachingEmail";

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
});

const moveAESchema = z.object({
  strategy_id: z.string().uuid("Invalid strategy ID"),
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
      `SELECT id, ae_email, gong_call_id, status, subject, body, error_message, created_at, strategy_id
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

    const { ae_email, gong_call_id } = parsed.data;

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
      res.status(404).json({ error: "AE not found in this strategy" });
      return;
    }

    const emailLog = await generateCoachingEmail({
      ae_email,
      gong_call_id,
      strategy_id: strategyId,
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

export default router;
