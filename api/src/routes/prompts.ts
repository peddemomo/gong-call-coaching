import { Router, Request, Response } from "express";
import { z } from "zod";
import pool from "../db/pool";

const router = Router();

const updatePromptSchema = z.object({
  body: z.string().min(1, "Prompt body cannot be empty"),
});

router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM public.prompts 
       WHERE is_active = true 
       ORDER BY created_at DESC 
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      res.json({ body: "", is_active: true });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching prompt:", error);
    res.status(500).json({ error: "Failed to fetch prompt" });
  }
});

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

      // Deactivate all existing prompts
      await client.query("UPDATE public.prompts SET is_active = false");

      // Insert new active prompt
      const result = await client.query(
        `INSERT INTO public.prompts (body, is_active, created_at)
         VALUES ($1, true, NOW())
         RETURNING *`,
        [body]
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

