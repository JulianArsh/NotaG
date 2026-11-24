import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import type { UserRole } from "@prisma/client";

export async function handleClerkWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const event = req.body;
    if (!event || !event.type) {
      return res.status(400).json({ message: "Invalid webhook payload." });
    }

    const { type, data } = event;

    if (type === "user.created" || type === "user.updated") {
      const id = data.id;
      const firstName = data.first_name || "";
      const lastName = data.last_name || "";
      const name = [firstName, lastName].filter(Boolean).join(" ").trim() || data.username || null;
      const email = data.email_addresses?.[0]?.email_address || null;
      const metaRole = data.public_metadata?.role || data.unsafe_metadata?.role;
      const role: UserRole =
        metaRole === "admin" || metaRole === "analyst" || metaRole === "listener"
          ? (metaRole as UserRole)
          : "listener";

      await prisma.user.upsert({
        where: { id },
        update: {
          name: name || undefined,
          email: email || undefined,
          ...(metaRole ? { role } : {}),
        },
        create: {
          id,
          name,
          email,
          role,
        },
      });

      return res.json({ received: true, action: "upserted", userId: id });
    }

    if (type === "user.deleted") {
      const id = data.id;
      if (id) {
        await prisma.user.delete({ where: { id } }).catch(() => null);
      }
      return res.json({ received: true, action: "deleted", userId: id });
    }

    res.json({ received: true, action: "ignored" });
  } catch (err) {
    next(err);
  }
}
