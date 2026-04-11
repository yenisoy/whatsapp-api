import express from "express";
import {
  listConversations,
  listConversationMessages,
  readConversation,
  sendConversationMessage
} from "../controllers/conversation.controller.js";

const router = express.Router();

router.get("/", listConversations);
router.get("/:conversationId/messages", listConversationMessages);
router.post("/:conversationId/messages", sendConversationMessage);
router.post("/:conversationId/read", readConversation);

export default router;
