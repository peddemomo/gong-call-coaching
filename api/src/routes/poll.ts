import { Router, Request, Response } from "express";
import { pollGongCalls } from "../services/pollGongCalls";

const router = Router();

/**
 * POST /poll
 * 
 * Manually trigger a poll of Gong for recent calls.
 * Useful for testing or on-demand processing.
 * 
 * Query params:
 *   - lookbackHours: How many hours back to look (default: 2)
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const lookbackHours = parseInt(req.query.lookbackHours as string) || 2;

    console.log(`[Poll API] Manual poll triggered with lookback: ${lookbackHours} hours`);

    const result = await pollGongCalls(lookbackHours);

    res.json({
      success: true,
      message: `Poll completed. Found ${result.callsFound} calls.`,
      summary: {
        callsFound: result.callsFound,
        callsProcessed: result.callsProcessed,
        callsSkipped: result.callsSkipped,
        callsAlreadyProcessed: result.callsAlreadyProcessed,
        callsFailed: result.callsFailed,
      },
      details: result.details,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error("[Poll API] Error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /poll/status
 * 
 * Check if polling is enabled and get configuration.
 */
router.get("/status", async (_req: Request, res: Response) => {
  const pollingEnabled = process.env.ENABLE_POLLING === "true";
  const pollingInterval = parseInt(process.env.POLLING_INTERVAL_MINUTES || "15");
  const lookbackHours = parseInt(process.env.POLLING_LOOKBACK_HOURS || "2");

  res.json({
    pollingEnabled,
    pollingInterval: `${pollingInterval} minutes`,
    lookbackHours,
    message: pollingEnabled
      ? `Automatic polling is running every ${pollingInterval} minutes`
      : "Automatic polling is disabled. Use POST /poll to trigger manually.",
  });
});

export default router;
