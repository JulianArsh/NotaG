import { Router } from "express";
import * as webhookController from "../controllers/webhook.controller";

const router = Router();

router.post("/clerk", webhookController.handleClerkWebhook);

export default router;
