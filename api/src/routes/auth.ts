import { Router, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import {
  AuthRequest,
  AuthUser,
  createAuthToken,
  AUTH_COOKIE_OPTIONS,
  requireAuth,
} from "../middleware/auth";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN;

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * POST /auth/google
 * Verify Google ID token, check domain, and issue session cookie.
 */
router.post("/google", async (req: AuthRequest, res: Response) => {
  const { credential } = req.body;

  if (!credential) {
    res.status(400).json({ error: "Missing credential" });
    return;
  }

  if (!GOOGLE_CLIENT_ID) {
    console.error("[Auth] GOOGLE_CLIENT_ID not configured");
    res.status(500).json({ error: "Google OAuth not configured" });
    return;
  }

  try {
    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }

    const { email, name, picture } = payload;

    if (!email) {
      res.status(401).json({ error: "Email not provided by Google" });
      return;
    }

    // Check domain restriction
    if (ALLOWED_EMAIL_DOMAIN) {
      const emailDomain = email.split("@")[1];
      if (emailDomain !== ALLOWED_EMAIL_DOMAIN) {
        console.log(
          `[Auth] Rejected login from ${email} - domain ${emailDomain} not allowed`
        );
        res.status(403).json({
          error: "Access denied",
          message: `Only users with @${ALLOWED_EMAIL_DOMAIN} email addresses can access this application.`,
        });
        return;
      }
    }

    // Create user object
    const user: AuthUser = {
      email,
      name: name || email.split("@")[0],
      picture: picture || "",
    };

    // Create JWT token
    const token = createAuthToken(user);

    // Set cookie and return user info
    res.cookie("auth_token", token, AUTH_COOKIE_OPTIONS);
    
    console.log(`[Auth] User logged in: ${email}`);
    
    res.json({
      user,
      message: "Login successful",
    });
  } catch (error) {
    console.error("[Auth] Google token verification failed:", error);
    res.status(401).json({ error: "Failed to verify Google token" });
  }
});

/**
 * GET /auth/me
 * Return current user from session.
 */
router.get("/me", requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

/**
 * POST /auth/logout
 * Clear session cookie.
 */
router.post("/logout", (req: AuthRequest, res: Response) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  });
  
  console.log(`[Auth] User logged out: ${req.user?.email || "unknown"}`);
  
  res.json({ message: "Logged out successfully" });
});

export default router;
