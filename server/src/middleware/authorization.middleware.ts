import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { prisma } from "../config/prisma";
import { syncUserFromClerk } from "../services/userSync.service";
import type { UserRole } from "@prisma/client";

export function requireRole(...roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { userId, sessionClaims } = getAuth(req);
    if (!userId) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }

    const claims = sessionClaims as {
      metadata?: { role?: string };
      publicMetadata?: { role?: string };
    } | undefined;
    const claimedRole =
      claims?.metadata?.role ?? claims?.publicMetadata?.role;

    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      const synced = await syncUserFromClerk(userId);
      user = { role: synced.role };
    }

    const role = user?.role === "admin"
      ? "admin"
      : user?.role === "analyst"
        ? "analyst"
        : (user?.role || claimedRole);

    if (role === "admin" || (role && roles.includes(role as UserRole))) {
      next();
      return;
    }

    res.status(403).json({ message: "Analyst or administrator permission required." });
  };
}
