import express from "express";
import { exportLatestPhoneStatuses, getLatestPhoneStatuses, getLogs, getLogStats, getUnmatchedWebhookLogs } from "../controllers/logs.controller.js";
import { requireAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/stats", getLogStats);
router.get("/phone-statuses/export", exportLatestPhoneStatuses);
router.get("/phone-statuses", getLatestPhoneStatuses);
router.get("/unmatched", requireAdmin, getUnmatchedWebhookLogs);
router.get("/", getLogs);

export default router;