import express from "express";
import { getLatestPhoneStatuses, getLogs, getLogStats, getUnmatchedWebhookLogs } from "../controllers/logs.controller.js";
import { requireAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/stats", getLogStats);
router.get("/phone-statuses", getLatestPhoneStatuses);
router.get("/unmatched", requireAdmin, getUnmatchedWebhookLogs);
router.get("/", getLogs);

export default router;