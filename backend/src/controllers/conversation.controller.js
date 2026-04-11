import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { markConversationRead, upsertConversationByPhone } from "../services/conversation.service.js";
import { sendWhatsAppText } from "../services/whatsapp.service.js";

const mapProviderStatusToLocalStatus = (providerStatus = "") => {
  const normalized = String(providerStatus || "").trim().toLowerCase();

  if (["failed", "undeliverable", "deleted"].includes(normalized)) {
    return "failed";
  }

  if (["sent"].includes(normalized)) return "sent";
  if (["delivered"].includes(normalized)) return "delivered";
  if (["read"].includes(normalized)) return "read";

  return "queued";
};

export const listConversations = async (req, res, next) => {
  try {
    const { q = "", limit = 50 } = req.query;
    const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const filter = { ownerId: req.user.id };
    const query = String(q || "").trim();

    if (query) {
      filter.$or = [
        { phone: { $regex: query, $options: "i" } },
        { contactName: { $regex: query, $options: "i" } }
      ];
    }

    const conversations = await Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(parsedLimit)
      .lean();

    return res.json(conversations);
  } catch (error) {
    return next(error);
  }
};

export const listConversationMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before = "" } = req.query;

    const conversation = await Conversation.findOne({ _id: conversationId, ownerId: req.user.id }).lean();
    if (!conversation) {
      return res.status(404).json({ message: "conversation not found" });
    }

    const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const filter = {
      ownerId: req.user.id,
      conversationId
    };

    if (String(before || "").trim()) {
      const beforeDate = new Date(String(before));
      if (!Number.isNaN(beforeDate.getTime())) {
        filter.createdAt = { $lt: beforeDate };
      }
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .lean();

    const ordered = [...messages].reverse();
    const oldest = ordered[0]?.createdAt;

    return res.json({
      conversation,
      messages: ordered,
      nextBefore: oldest || null,
      hasMore: messages.length === parsedLimit
    });
  } catch (error) {
    return next(error);
  }
};

export const sendConversationMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { text = "" } = req.body;
    const messageText = String(text || "").trim();

    if (!messageText) {
      return res.status(400).json({ message: "text is required" });
    }

    const conversation = await Conversation.findOne({ _id: conversationId, ownerId: req.user.id });
    if (!conversation) {
      return res.status(404).json({ message: "conversation not found" });
    }

    const sendResult = await sendWhatsAppText({
      phone: conversation.phone,
      text: messageText,
      credentials: {
        whatsappToken: req.user?.whatsappToken,
        whatsappPhoneId: req.user?.whatsappPhoneId
      }
    });

    const status = sendResult.success
      ? mapProviderStatusToLocalStatus(sendResult.providerStatus || "accepted")
      : "failed";

    const message = await Message.create({
      ownerId: req.user.id,
      phone: conversation.phone,
      conversationId: conversation._id,
      templateId: null,
      direction: "outbound",
      messageType: "text",
      body: messageText,
      variables: {},
      status,
      error: sendResult.success ? "" : (sendResult.error || "send failed"),
      providerMessageId: sendResult.providerMessageId || "",
      providerStatus: sendResult.providerStatus || "",
      providerRequestUrl: sendResult.providerRequestUrl || "",
      providerRequestBody: sendResult.providerRequestBody || null
    });

    await upsertConversationByPhone({
      ownerId: req.user.id,
      phone: conversation.phone,
      contactName: conversation.contactName,
      messageType: "text",
      direction: "outbound",
      messageText,
      messageAt: message.createdAt,
      incrementUnread: false
    });

    return res.status(201).json({ success: sendResult.success, message });
  } catch (error) {
    return next(error);
  }
};

export const readConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const updated = await markConversationRead({ ownerId: req.user.id, conversationId });

    if (!updated) {
      return res.status(404).json({ message: "conversation not found" });
    }

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
};
