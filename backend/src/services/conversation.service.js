import Contact from "../models/contact.model.js";
import Conversation from "../models/conversation.model.js";

export const normalizePhone = (phone = "") => String(phone || "").replaceAll(/\D/g, "").trim();

const toPreviewText = (value = "") => {
  const normalized = String(value || "").replaceAll(/\s+/g, " ").trim();
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
};

export const resolveContactName = async ({ ownerId, phone }) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return "";
  }

  const contact = await Contact.findOne({ ownerId, phone: normalizedPhone }).select("name").lean();
  return String(contact?.name || "").trim();
};

export const upsertConversationByPhone = async ({
  ownerId,
  phone,
  contactName = "",
  messageText = "",
  messageType = "text",
  direction = "outbound",
  messageAt = new Date(),
  incrementUnread = false
}) => {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    throw new Error("phone is required");
  }

  const update = {
    $set: {
      lastMessageText: toPreviewText(messageText),
      lastMessageType: String(messageType || "text"),
      lastDirection: direction === "inbound" ? "inbound" : "outbound",
      lastMessageAt: messageAt instanceof Date ? messageAt : new Date(messageAt)
    },
    $setOnInsert: {
      ownerId,
      phone: normalizedPhone,
      unreadCount: 0
    }
  };

  const normalizedContactName = String(contactName || "").trim();
  if (normalizedContactName) {
    update.$set.contactName = normalizedContactName;
  }

  if (incrementUnread) {
    update.$inc = { unreadCount: 1 };
  }

  return Conversation.findOneAndUpdate(
    { ownerId, phone: normalizedPhone },
    update,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

export const markConversationRead = async ({ ownerId, conversationId }) => {
  return Conversation.findOneAndUpdate(
    { _id: conversationId, ownerId },
    { $set: { unreadCount: 0 } },
    { new: true }
  );
};
