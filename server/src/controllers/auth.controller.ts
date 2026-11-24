import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { prisma } from "../config/prisma";
import { syncUserFromClerk, getUserProfile, setUserRole } from "../services/userSync.service";
import type { UserRole } from "@prisma/client";

export async function syncCurrentUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const { name, email } = req.body as { name?: string; email?: string };
    const user = await syncUserFromClerk(userId, { name, email });
    res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

export async function getCurrentUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const user = await getUserProfile(userId);
    res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

export async function updateUserRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const { role } = req.body as { role?: UserRole };
    if (!role || !["listener", "analyst", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be 'listener', 'analyst', or 'admin'." });
    }

    const updated = await setUserRole(userId, role);
    res.json({ ok: true, user: updated });
  } catch (err) {
    next(err);
  }
}

export async function listAllUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            savedItems: true,
            comments: true,
          },
        },
      },
    });
    res.json({ ok: true, users });
  } catch (err) {
    next(err);
  }
}
