import "dotenv/config";
import express from "express";
import cors from "cors";
import healthRouter from "./routes/health";
import aesRouter from "./routes/aes";
import promptsRouter from "./routes/prompts";
import emailLogsRouter from "./routes/emailLogs";
import generateRouter from "./routes/generate";
import strategiesRouter from "./routes/strategies";

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

// Routes
app.use("/health", healthRouter);
app.use("/strategies", strategiesRouter);

// Legacy routes (backward compatible - default to Default Strategy)
app.use("/aes", aesRouter);
app.use("/prompt", promptsRouter);
app.use("/email-logs", emailLogsRouter);
app.use("/generate", generateRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
