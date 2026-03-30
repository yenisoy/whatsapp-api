import express from "express";
import { sendBulkMessage, sendSingleMessage } from "../controllers/send.controller.js";

const router = express.Router();

router.post("/", sendSingleMessage);
router.post("/bulk", sendBulkMessage);

export default router;