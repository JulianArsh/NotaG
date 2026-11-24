import http from "http";
import { app } from "../../app";
import { prisma } from "../../config/prisma";
import { syncUserFromClerk, setUserRole, getUserProfile } from "../userSync.service";

function request(options: http.RequestOptions, body?: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode || 200, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode || 200, body: data });
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("Request timed out - middleware likely hanging!"));
    });
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runAuthTests() {
  console.log("=== STARTING AUTH & USER SYNC TESTS ===");
  const server = app.listen(5098);

  try {
    // 1. Unauthenticated request to protected route must NOT hang and must return 401 JSON
    console.log("[1] Testing unauthenticated access to /api/auth/me...");
    const unauthMe = await request({
      hostname: "localhost",
      port: 5098,
      path: "/api/auth/me",
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    console.log("    Response status:", unauthMe.status, "Body:", unauthMe.body);
    if (unauthMe.status !== 401) {
      throw new Error(`Expected status 401, got ${unauthMe.status}`);
    }

    console.log("[2] Testing unauthenticated access to /api/pieces/saved (was previously hanging)...");
    const unauthSaved = await request({
      hostname: "localhost",
      port: 5098,
      path: "/api/pieces/saved",
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    console.log("    Response status:", unauthSaved.status, "Body:", unauthSaved.body);
    if (unauthSaved.status !== 401) {
      throw new Error(`Expected status 401, got ${unauthSaved.status}`);
    }

    // 2. Direct userSync service test against Neon DB
    const testUserId = "test-user-sync-verification-" + Date.now();
    console.log(`[3] Testing direct user sync for ${testUserId}...`);
    const synced = await syncUserFromClerk(testUserId, {
      name: "Wolfgang Amadeus Mozart",
      email: "mozart@vienna.at",
      role: "analyst",
    });
    console.log("    Synced user in Neon DB:", synced);
    if (synced.id !== testUserId || synced.role !== "analyst" || synced.name !== "Wolfgang Amadeus Mozart") {
      throw new Error("User sync failed to properly write to Neon DB");
    }

    // 3. Test getUserProfile
    console.log("[4] Testing getUserProfile from Neon DB...");
    const profile = await getUserProfile(testUserId);
    console.log("    Retrieved profile:", profile?.name, profile?.role);
    if (!profile || profile.role !== "analyst") {
      throw new Error("Failed to retrieve profile");
    }

    // 4. Test setUserRole
    console.log("[5] Testing setUserRole elevation to admin...");
    const elevated = await setUserRole(testUserId, "admin");
    console.log("    Elevated role:", elevated.role);
    if (elevated.role !== "admin") {
      throw new Error("Failed to elevate role");
    }

    // 5. Test Webhook user.created event
    const webhookUserId = "webhook-test-user-" + Date.now();
    console.log(`[6] Testing Clerk Webhook user.created for ${webhookUserId}...`);
    const webhookRes = await request(
      {
        hostname: "localhost",
        port: 5098,
        path: "/api/webhooks/clerk",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        type: "user.created",
        data: {
          id: webhookUserId,
          first_name: "Ludwig",
          last_name: "van Beethoven",
          email_addresses: [{ email_address: "beethoven@bonn.de" }],
          public_metadata: { role: "listener" },
        },
      }
    );
    console.log("    Webhook response:", webhookRes.body);

    const webhookDbUser = await prisma.user.findUnique({ where: { id: webhookUserId } });
    console.log("    Verified webhook user in Neon DB:", webhookDbUser);
    if (!webhookDbUser || webhookDbUser.name !== "Ludwig van Beethoven" || webhookDbUser.email !== "beethoven@bonn.de") {
      throw new Error("Webhook user.created failed to write user to Neon DB");
    }

    // 6. Test Webhook user.updated
    console.log("[7] Testing Clerk Webhook user.updated...");
    await request(
      {
        hostname: "localhost",
        port: 5098,
        path: "/api/webhooks/clerk",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        type: "user.updated",
        data: {
          id: webhookUserId,
          first_name: "Ludwig",
          last_name: "van Beethoven (Maestro)",
          email_addresses: [{ email_address: "beethoven@bonn.de" }],
          public_metadata: { role: "analyst" },
        },
      }
    );
    const updatedDbUser = await prisma.user.findUnique({ where: { id: webhookUserId } });
    console.log("    Updated user in DB:", updatedDbUser?.name, updatedDbUser?.role);
    if (updatedDbUser?.name !== "Ludwig van Beethoven (Maestro)" || updatedDbUser?.role !== "analyst") {
      throw new Error("Webhook user.updated failed to update user in Neon DB");
    }

    // 7. Test Webhook user.deleted
    console.log("[8] Testing Clerk Webhook user.deleted...");
    await request(
      {
        hostname: "localhost",
        port: 5098,
        path: "/api/webhooks/clerk",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        type: "user.deleted",
        data: { id: webhookUserId },
      }
    );
    const deletedDbUser = await prisma.user.findUnique({ where: { id: webhookUserId } });
    console.log("    User in DB after deletion:", deletedDbUser);
    if (deletedDbUser !== null) {
      throw new Error("Webhook user.deleted failed to delete user from Neon DB");
    }

    // Cleanup test user
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => null);

    console.log("\nALL AUTH & USER SYNC TESTS PASSED SUCCESSFULLY! ✓");
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runAuthTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
