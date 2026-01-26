import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";

export interface AuthUser {
  email: string;
  name: string;
  picture: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

/**
 * Middleware to verify JWT token from cookie and attach user to request.
 * Returns 401 if not authenticated.
 */
export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = req.cookies?.auth_token;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
};

/**
 * Optional auth middleware - attaches user if token exists but doesn't require it.
 */
export const optionalAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = req.cookies?.auth_token;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      req.user = decoded;
    } catch {
      // Token invalid, continue without user
    }
  }

  next();
};

/**
 * Creates a JWT token for the authenticated user.
 */
export const createAuthToken = (user: AuthUser): string => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
};

/**
 * Cookie options for auth token.
 */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
