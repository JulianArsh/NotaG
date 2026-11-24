import { Router } from "express";
import * as commentController from "../controllers/comment.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.delete("/:id", requireAuth, commentController.deleteComment);
router.patch("/:id", requireAuth, commentController.updateComment);

export default router;
