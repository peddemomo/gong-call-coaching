import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import healthRouter from "./routes/health";
import aesRouter from "./routes/aes";
import promptsRouter from "./routes/prompts";
import emailLogsRouter from "./routes/emailLogs";
import generateRouter from "./routes/generate";
import strategiesRouter from "./routes/strategies";
import userflowWebhookRouter from "./routes/userflowWebhook";
import pollRouter from "./routes/poll";
import authRouter from "./routes/auth";
import { requireAuth } from "./middleware/auth";
import { startPolling } from "./services/pollGongCalls";

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Public routes (no auth required)
app.use("/health", healthRouter);
app.use("/auth", authRouter);

// Protected routes (require authentication)
app.use("/strategies", requireAuth, strategiesRouter);

// Legacy routes (backward compatible - default to Default Strategy)
app.use("/aes", requireAuth, aesRouter);
app.use("/prompt", requireAuth, promptsRouter);
app.use("/email-logs", requireAuth, emailLogsRouter);
app.use("/generate", requireAuth, generateRouter);

// Userflow webhook for doctor info requests (no auth - external webhook)
app.use("/userflow-webhook", userflowWebhookRouter);

// Polling endpoint for Gong calls (protected)
app.use("/poll", requireAuth, pollRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);

  // Start background polling if enabled
  if (process.env.ENABLE_POLLING === "true") {
    const intervalMinutes = parseInt(process.env.POLLING_INTERVAL_MINUTES || "15");
    const lookbackHours = parseInt(process.env.POLLING_LOOKBACK_HOURS || "2");
    startPolling(intervalMinutes, lookbackHours);
  } else {
    console.log("[Poll] Background polling is disabled. Set ENABLE_POLLING=true to enable.");
  }
});
