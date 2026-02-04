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
import { startPolling } from "./services/pollGongCalls";

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS - allow Vite dev server (5173 or 5174 when 5173 is in use)
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) cb(null, origin || true);
      else cb(null, false);
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Public routes (no auth required)
app.use("/health", healthRouter);
app.use("/auth", authRouter);

// App routes (no auth - auth disabled for local access)
app.use("/strategies", strategiesRouter);

// Legacy routes (backward compatible - default to Default Strategy)
app.use("/aes", aesRouter);
app.use("/prompt", promptsRouter);
app.use("/email-logs", emailLogsRouter);
app.use("/generate", generateRouter);

// Userflow webhook for doctor info requests (no auth - external webhook)
app.use("/userflow-webhook", userflowWebhookRouter);

// Polling endpoint for Gong calls
app.use("/poll", pollRouter);

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
