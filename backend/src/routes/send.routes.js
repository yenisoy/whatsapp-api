import express from "express";
import { sendBatchMessage, sendSingleMessage } from "../controllers/send.controller.js";

const router = express.Router();

router.post("/", sendSingleMessage);
router.post("/batch", sendBatchMessage);

export default router;