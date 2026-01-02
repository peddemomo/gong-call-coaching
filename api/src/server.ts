import "dotenv/config";
import express from "express";
import cors from "cors";
import healthRouter from "./routes/health";
import aesRouter from "./routes/aes";

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
app.use("/aes", aesRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

