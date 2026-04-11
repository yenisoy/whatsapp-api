import express from "express";
import { receiveWhatsAppWebhook, verifyWhatsAppWebhook } from "../controllers/webhook.controller.js";

const router = express.Router();

router.get("/whatsapp", verifyWhatsAppWebhook);
router.post("/whatsapp", receiveWhatsAppWebhook);
router.get("/whatsapp/:webhookPath", verifyWhatsAppWebhook);
router.post("/whatsapp/:webhookPath", receiveWhatsAppWebhook);

export default router;
