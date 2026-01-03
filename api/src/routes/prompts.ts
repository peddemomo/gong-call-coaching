import { Router, Request, Response } from "express";
import { z } from "zod";
import pool from "../db/pool";
import { DEFAULT_STRATEGY_ID } from "../services/generateCoachingEmail";

const router = Router();

const updatePromptSchema = z.object({
  body: z.string().min(1, "Prompt body cannot be empty"),
});

// GET /prompt - Get active prompt (backward compatible - defaults to Default Strategy)
router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM public.prompts 
       WHERE strategy_id = $1 AND is_active = true 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [DEFAULT_STRATEGY_ID]
    );

    if (result.rows.length === 0) {
      res.json({ body: "", is_active: true, strategy_id: DEFAULT_STRATEGY_ID });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching prompt:", error);
    res.status(500).json({ error: "Failed to fetch prompt" });
  }
});

// PUT /prompt - Set active prompt (backward compatible - defaults to Default Strategy)
router.put("/", async (req: Request, res: Response) => {
  try {
    const parsed = updatePromptSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors,
      });
      return;
    }

    const { body } = parsed.data;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Deactivate all existing prompts for Default Strategy only
      await client.query(
        "UPDATE public.prompts SET is_active = false WHERE strategy_id = $1",
        [DEFAULT_STRATEGY_ID]
      );

      // Insert new active prompt
      const result = await client.query(
        `INSERT INTO public.prompts (body, is_active, strategy_id, created_at)
         VALUES ($1, true, $2, NOW())
         RETURNING *`,
        [body, DEFAULT_STRATEGY_ID]
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
    console.error("Error updating prompt:", error);
    res.status(500).json({ error: "Failed to update prompt" });
  }
});

export default router;
