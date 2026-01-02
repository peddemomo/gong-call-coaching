import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  generateCoachingEmail,
  DuplicateEmailError,
} from "../services/generateCoachingEmail";

const router = Router();

const generateRequestSchema = z.object({
  ae_email: z.string().email("Invalid email address"),
  gong_call_id: z.string().min(1, "Gong call ID is required"),
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = generateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors,
      });
      return;
    }

    const { ae_email, gong_call_id } = parsed.data;

    const emailLog = await generateCoachingEmail({ ae_email, gong_call_id });

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

