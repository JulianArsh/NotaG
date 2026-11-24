import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { syncUserFromClerk } from "../services/userSync.service";

/**
 * Express middleware to enforce authentication and guarantee
 * the user is synchronized to the Neon DB.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { userId, sessionClaims } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: "Authentication required." });
  }

  // Ensure user is lazily persisted or updated in Neon DB
  try {
    const claims = sessionClaims as Record<string, any> | undefined;
    const name =
      claims?.name ||
      claims?.fullName ||
      (claims?.firstName
        ? `${claims.firstName} ${claims.lastName || ""}`.trim()
        : null);
    const email = claims?.email || claims?.email_address || null;

    // Fire and await sync so subsequent route logic has guaranteed DB user row
    await syncUserFromClerk(userId, { name, email });
  } catch (err: any) {
    console.error("[requireAuth] Auto-sync to DB error:", err?.message || err);
  }

  next();
}

/**
 * Optional middleware that attempts to sync user to Neon DB if token is present
 */
export async function optionalAuthSync(req: Request, _res: Response, next: NextFunction) {
  const { userId, sessionClaims } = getAuth(req);
  if (userId) {
    try {
      const claims = sessionClaims as Record<string, any> | undefined;
      const name =
        claims?.name ||
        claims?.fullName ||
        (claims?.firstName
          ? `${claims.firstName} ${claims.lastName || ""}`.trim()
          : null);
      const email = claims?.email || claims?.email_address || null;
      await syncUserFromClerk(userId, { name, email });
    } catch {
      // ignore in optional mode
    }
  }
  next();
}
