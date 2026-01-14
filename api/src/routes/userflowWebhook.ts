import { Router, Request, Response } from "express";
import { z } from "zod";
import pool from "../db/pool";
import { searchDoctors } from "../services/doctorLookup";
import { sendDoctorRequestNotification } from "../services/doctorRequestNotifier";

const router = Router();

/**
 * Userflow webhook payload schema
 * Userflow sends event data when a user submits a form/popup
 */
const UserflowWebhookSchema = z.object({
  event: z.string(),
  userId: z.string().optional(),
  userEmail: z.string().email().optional(),
  userName: z.string().optional(),
  data: z
    .object({
      doctorName: z.string().optional(),
      doctor_name: z.string().optional(), // Alternative field name
    })
    .passthrough(),
  timestamp: z.string().optional(),
});

type UserflowWebhookPayload = z.infer<typeof UserflowWebhookSchema>;

/**
 * POST /userflow-webhook
 * Receives webhook events from Userflow when a user submits the doctor request popup
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    // Validate the webhook payload
    const payload = UserflowWebhookSchema.safeParse(req.body);

    if (!payload.success) {
      console.error("Invalid webhook payload:", payload.error.errors);
      return res.status(400).json({
        error: "Invalid payload",
        details: payload.error.errors,
      });
    }

    const data = payload.data;

    // Extract doctor name from payload (support different field names)
    const doctorName =
      data.data.doctorName ||
      data.data.doctor_name ||
      (data.data as Record<string, unknown>).doctor ||
      (data.data as Record<string, unknown>).name;

    if (!doctorName || typeof doctorName !== "string") {
      console.log("Webhook received but no doctor name found:", data);
      return res.status(200).json({
        message: "Webhook received but no doctor name found in payload",
        received: data.event,
      });
    }

    const userEmail = data.userEmail || "unknown@example.com";
    const userId = data.userId;
    const userName = data.userName;

    console.log(
      `Doctor info request received: "${doctorName}" from ${userEmail}`
    );

    // Look up potential matching doctors from NPI registry
    let matchingDoctors;
    try {
      matchingDoctors = await searchDoctors(doctorName);
      console.log(`Found ${matchingDoctors.length} matching doctors`);
    } catch (error) {
      console.error("Error searching for doctors:", error);
      matchingDoctors = [];
    }

    // Log the request to the database
    try {
      await pool.query(
        `INSERT INTO public.doctor_requests 
         (doctor_name, user_email, user_id, user_name, matching_doctors_count, raw_payload, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          doctorName,
          userEmail,
          userId || null,
          userName || null,
          matchingDoctors.length,
          JSON.stringify(req.body),
        ]
      );
    } catch (dbError) {
      console.error("Error logging doctor request to database:", dbError);
      // Continue anyway - the email notification is more important
    }

    // Send email notification
    const notificationEmail = process.env.DOCTOR_REQUEST_NOTIFICATION_EMAIL;

    if (!notificationEmail) {
      console.warn(
        "DOCTOR_REQUEST_NOTIFICATION_EMAIL not set, skipping email notification"
      );
    } else {
      try {
        await sendDoctorRequestNotification(
          {
            doctorName,
            userEmail,
            userId,
            userName,
            submittedAt: new Date(),
            matchingDoctors,
          },
          notificationEmail
        );
      } catch (emailError) {
        console.error("Error sending notification email:", emailError);
        // Don't fail the webhook response - we've logged it at least
      }
    }

    return res.status(200).json({
      success: true,
      message: "Doctor request processed",
      doctorName,
      matchesFound: matchingDoctors.length,
    });
  } catch (error) {
    console.error("Error processing Userflow webhook:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /userflow-webhook/health
 * Health check endpoint for the webhook
 */
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", endpoint: "userflow-webhook" });
});

export default router;
