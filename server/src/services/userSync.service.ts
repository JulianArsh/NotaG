import { clerkClient } from "@clerk/express";
import { prisma } from "../config/prisma";
import type { UserRole } from "@prisma/client";

interface SyncUserData {
  name?: string | null;
  email?: string | null;
  role?: UserRole;
}

const hasValidSecretKey = Boolean(
  process.env.CLERK_SECRET_KEY &&
    process.env.CLERK_SECRET_KEY.startsWith("sk_")
);

export async function syncUserFromClerk(
  userId: string,
  hints?: SyncUserData
) {
  let fetchedName = hints?.name ?? null;
  let fetchedEmail = hints?.email ?? null;
  let fetchedRole = hints?.role;

  // If secret key is configured, fetch full user details from Clerk
  if (hasValidSecretKey && (!fetchedName || !fetchedEmail || !fetchedRole)) {
    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      if (clerkUser) {
        if (!fetchedName) {
          const fullName = [clerkUser.firstName, clerkUser.lastName]
            .filter(Boolean)
            .join(" ")
            .trim();
          fetchedName = fullName || clerkUser.username || null;
        }
        if (!fetchedEmail && clerkUser.emailAddresses && clerkUser.emailAddresses.length > 0) {
          fetchedEmail = clerkUser.emailAddresses[0].emailAddress;
        }
        if (!fetchedRole) {
          const metaRole =
            (clerkUser.publicMetadata?.role as string) ||
            (clerkUser.unsafeMetadata?.role as string);
          if (metaRole === "admin" || metaRole === "analyst" || metaRole === "listener") {
            fetchedRole = metaRole as UserRole;
          }
        }
      }
    } catch (err: any) {
      console.warn(`[userSync] Could not fetch user from Clerk API for ${userId}:`, err?.message || err);
    }
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
  });

  const resolvedName = fetchedName || existing?.name || null;
  const resolvedEmail = fetchedEmail || existing?.email || null;
  const resolvedRole = existing?.role ?? (fetchedRole || "listener");

  const user = await prisma.user.upsert({
    where: { id: userId },
    update: {
      name: resolvedName,
      email: resolvedEmail,
      ...(fetchedRole ? { role: fetchedRole } : {}),
    },
    create: {
      id: userId,
      name: resolvedName,
      email: resolvedEmail,
      role: resolvedRole,
    },
    include: {
      _count: {
        select: {
          savedItems: true,
          comments: true,
        },
      },
    },
  });

  return user;
}

export async function getUserProfile(userId: string) {
  let user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          savedItems: true,
          comments: true,
        },
      },
    },
  });

  if (!user) {
    user = await syncUserFromClerk(userId);
  }

  return user;
}

export async function setUserRole(userId: string, role: UserRole) {
  const user = await prisma.user.upsert({
    where: { id: userId },
    update: { role },
    create: {
      id: userId,
      role,
    },
    include: {
      _count: {
        select: {
          savedItems: true,
          comments: true,
        },
      },
    },
  });

  if (hasValidSecretKey) {
    try {
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: { role },
      });
    } catch (err: any) {
      console.warn(`[userSync] Failed to mirror role ${role} to Clerk for ${userId}:`, err?.message || err);
    }
  }

  return user;
}
