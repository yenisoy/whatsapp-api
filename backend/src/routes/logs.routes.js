import express from "express";
import { getLogs, getLogStats, getUnmatchedWebhookLogs } from "../controllers/logs.controller.js";
import { requireAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/stats", getLogStats);
router.get("/unmatched", requireAdmin, getUnmatchedWebhookLogs);
router.get("/", getLogs);

export default router;