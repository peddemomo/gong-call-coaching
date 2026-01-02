import { Router, Request, Response } from "express";
import { z } from "zod";
import pool from "../db/pool";

const router = Router();

const createAESchema = z.object({
  email: z.string().email("Invalid email address"),
});

router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM public.aes ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching aes:", error);
    res.status(500).json({ error: "Failed to fetch aes" });
  }
});

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

    const result = await pool.query(
      `INSERT INTO public.aes (email, enabled, created_at)
       VALUES ($1, true, NOW())
       RETURNING *`,
      [email]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      res.status(409).json({ error: "An AE with this email already exists" });
      return;
    }
    console.error("Error creating AE:", error);
    res.status(500).json({ error: "Failed to create AE" });
  }
});

export default router;

