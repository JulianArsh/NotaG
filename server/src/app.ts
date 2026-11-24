import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { pathToFileURL } from "url";
import { clerkMiddleware } from "@clerk/express";

import pieceRoutes from "./routes/piece.routes";
import scoreRoutes from "./routes/score.routes";
import recordingRoutes from "./routes/recording.routes";
import commentRoutes from "./routes/comment.routes";
import authRoutes from "./routes/auth.routes";
import webhookRoutes from "./routes/webhook.routes";
import { errorMiddleware } from "./middleware/error.middleware";

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

// Public health check
app.get("/api/health", (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// Webhook routes (do not require Clerk auth headers)
app.use("/api/webhooks", webhookRoutes);

// Populates req.auth on every request
app.use(clerkMiddleware());

// Application API routes
app.use("/api/auth", authRoutes);
app.use("/api/pieces", pieceRoutes);
app.use("/api/scores", scoreRoutes);
app.use("/api/recordings", recordingRoutes);
app.use("/api/comments", commentRoutes);

app.use(errorMiddleware);

export { app };

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href.toLowerCase() ===
    import.meta.url.toLowerCase();

if (isDirectRun) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Nota server listening on :${port}`));
}
