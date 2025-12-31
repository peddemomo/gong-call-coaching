import express, { Request, Response } from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS to allow requests from the frontend
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Hello from Gong Call Coaching API! BLAH!" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

