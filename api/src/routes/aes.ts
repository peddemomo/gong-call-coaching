import { Router, Request, Response } from "express";
import { z } from "zod";
import pool from "../db/pool";
import { DEFAULT_STRATEGY_ID } from "../services/generateCoachingEmail";

const router = Router();

const createAESchema = z.object({
  email: z.string().email("Invalid email address"),
});

// GET /aes - List all AEs (backward compatible - defaults to Default Strategy)
router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM public.aes WHERE strategy_id = $1 ORDER BY created_at DESC",
      [DEFAULT_STRATEGY_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching aes:", error);
    res.status(500).json({ error: "Failed to fetch aes" });
  }
});

// POST /aes - Create AE (backward compatible - defaults to Default Strategy)
// Returns 409 if AE email already exists in ANY strategy (global uniqueness)
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = createAESchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors,
      });
      return;
    }

    const { email } = parsed.data;

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
      [email, DEFAULT_STRATEGY_ID]
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

export default router;
