import express from "express";
import { getLogs, getLogStats } from "../controllers/logs.controller.js";

const router = express.Router();

router.get("/stats", getLogStats);
router.get("/", getLogs);

export default router;