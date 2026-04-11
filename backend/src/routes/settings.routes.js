import express from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller.js";
import { requireAdmin, requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", requireAuth, requireAdmin, getSettings);
router.put("/", requireAuth, requireAdmin, updateSettings);

export default router;
