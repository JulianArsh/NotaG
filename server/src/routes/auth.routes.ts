import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/authorization.middleware";

const router = Router();

// Synchronize authenticated user from Clerk into Neon DB
router.post("/sync", requireAuth, authController.syncCurrentUser);

// Get current user profile from Neon DB
router.get("/me", requireAuth, authController.getCurrentUser);

// Update user's role (supports local role assignment/elevation)
router.patch("/role", requireAuth, authController.updateUserRole);

// List all registered users (admin/analyst view)
router.get("/users", requireAuth, requireRole("analyst", "admin"), authController.listAllUsers);

export default router;
