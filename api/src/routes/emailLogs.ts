import { Router, Request, Response } from "express";
import pool from "../db/pool";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, ae_email, gong_call_id, status, subject, body, error_message, created_at
       FROM public.email_logs
       ORDER BY created_at DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching email logs:", error);
    res.status(500).json({ error: "Failed to fetch email logs" });
  }
});

export default router;

