import { Router, Request, Response } from "express";
import pool from "../db/pool";
import { DEFAULT_STRATEGY_ID } from "../services/generateCoachingEmail";

const router = Router();

// GET /email-logs - List email logs (backward compatible - defaults to Default Strategy)
router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, ae_email, gong_call_id, status, subject, body, error_message, created_at, strategy_id
       FROM public.email_logs
       WHERE strategy_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [DEFAULT_STRATEGY_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching email logs:", error);
    res.status(500).json({ error: "Failed to fetch email logs" });
  }
});

export default router;
