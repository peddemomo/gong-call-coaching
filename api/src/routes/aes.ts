import { Router, Request, Response } from "express";
import pool from "../db/pool";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM public.aes");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching aes:", error);
    res.status(500).json({ error: "Failed to fetch aes" });
  }
});

export default router;

