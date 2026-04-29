import Message from "../models/message.model.js";
import UnmatchedWebhookLog from "../models/unmatched-webhook-log.model.js";
import User from "../models/user.model.js";
import { normalizePhone, upsertConversationByPhone } from "../services/conversation.service.js";
import { buildWebhookEventSummary, createWebhookEventLog } from "../services/webhook-event-log.service.js";
import { relayWhatsAppWebhook } from "../services/webhook-relay.service.js";

const findWebhookUser = async (webhookPath = "") => {
  const normalizedPath = String(webhookPath || "").trim();
  if (!normalizedPath) {
    return null;
  }

  return User.findOne({ webhookPath: normalizedPath }).select("_id webhookToken whatsappPhoneId relayWebhookUrl relayWebhookVerifyToken").lean();
};

const extractWebhookPhoneNumberIds = (entries = []) => {
  const changes = entries.flatMap((entry) => (Array.isArray(entry?.changes) ? entry.changes : []));

  return changes
    .map((change) => String(change?.value?.metadata?.phone_number_id || "").trim())
    .filter(Boolean);
};

const findWebhookUserByPhoneId = async (phoneNumberIds = []) => {
  const normalizedIds = Array.from(new Set((Array.isArray(phoneNumberIds) ? phoneNumberIds : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)));

  if (!normalizedIds.length) {
    return null;
  }

  return User.findOne({ whatsappPhoneId: { $in: normalizedIds } })
    .select("_id webhookToken whatsappPhoneId relayWebhookUrl relayWebhookVerifyToken")
    .lean();
};

const resolveWebhookUser = async ({ webhookPath = "", entries = [] } = {}) => {
  if (String(webhookPath || "").trim()) {
    return findWebhookUser(webhookPath);
  }

  const phoneNumberIds = extractWebhookPhoneNumberIds(entries);
  return findWebhookUserByPhoneId(phoneNumberIds);
};

const extractInboundText = (item = {}) => {
  const type = String(item?.type || "").toLowerCase();

  if (type === "text") {
    return String(item?.text?.body || "").trim();
  }

  if (type === "button") {
    return String(item?.button?.text || "").trim();
  }

  if (type === "interactive") {
    const listTitle = item?.interactive?.list_reply?.title;
    const buttonTitle = item?.interactive?.button_reply?.title;
    return String(listTitle || buttonTitle || "Interactive message").trim();
  }

  if (["image", "video", "document"].includes(type)) {
    const caption = String(item?.[type]?.caption || "").trim();
    return caption || `[${type}]`;
  }

  if (type === "audio") {
    return "[audio]";
  }

  if (type === "sticker") {
    return "[sticker]";
  }

  return `[${type || "message"}]`;
};

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

const toChangePayload = (change = {}) => {
  const statuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];
  const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];

  if (!messages.length) {
    return { statuses, incoming: null };
  }

  return {
    statuses,
    incoming: {
      phoneNumberId: String(change?.value?.metadata?.phone_number_id || "").trim(),
      messages,
      contacts: Array.isArray(change?.value?.contacts) ? change.value.contacts : []
    }
  };
};

const extractWebhookPayload = (entries = []) => {
  const changes = entries.flatMap((entry) => (Array.isArray(entry?.changes) ? entry.changes : []));
  const mapped = changes.map(toChangePayload);

  return {
    statuses: mapped.flatMap((item) => item.statuses),
    incomingMessages: mapped.map((item) => item.incoming).filter(Boolean)
  };
};

const updateMessageStatuses = async (statuses = [], ownerId = null) => {
  await Promise.all(
    statuses.map(async (item) => {
      const providerMessageId = String(item?.id || "").trim();
      if (!providerMessageId) {
        return;
      }

      const providerStatus = String(item?.status || "").trim().toLowerCase();
      const localStatus = mapProviderStatusToLocalStatus(providerStatus);
      const providerErrors = Array.isArray(item?.errors) ? item.errors : [];
      const providerError = providerErrors.length
        ? providerErrors
          .map((errorItem) => String(errorItem?.title || errorItem?.message || errorItem?.code || "").trim())
          .filter(Boolean)
          .join(" | ")
        : "";
      const updatePayload = {
        providerStatus,
        status: localStatus
      };

      if (providerError) {
        updatePayload.error = String(providerError);
      }

      const query = ownerId ? { providerMessageId, ownerId } : { providerMessageId };

      await Message.findOneAndUpdate(
        query,
        updatePayload,
        { sort: { createdAt: -1 } }
      );
    })
  );
};

const createInboundMessage = async ({ ownerId, message, contacts = [] }) => {
  const providerMessageId = String(message?.id || "").trim();
  const fromPhone = normalizePhone(message?.from || "");

  if (!providerMessageId || !fromPhone) {
    return;
  }

  const alreadyExists = await Message.findOne({ ownerId, providerMessageId }).select("_id").lean();
  if (alreadyExists?._id) {
    return;
  }

  const contactName = String(
    contacts.find((contact) => normalizePhone(contact?.wa_id || "") === fromPhone)?.profile?.name || ""
  ).trim();

  const body = extractInboundText(message);
  const conversation = await upsertConversationByPhone({
    ownerId,
    phone: fromPhone,
    contactName,
    messageText: body,
    messageType: message?.type || "text",
    direction: "inbound",
    incrementUnread: true
  });

  await Message.create({
    ownerId,
    phone: fromPhone,
    conversationId: conversation?._id || null,
    templateId: null,
    direction: "inbound",
    messageType: String(message?.type || "text"),
    body,
    variables: {},
    status: "delivered",
    providerMessageId,
    providerStatus: "received"
  });
};

const processIncomingMessages = async (incomingMessages = [], forcedOwner = null) => {
  await Promise.all(
    incomingMessages.map(async (bundle) => {
      let owner = forcedOwner;

      if (!owner?._id) {
        owner = await User.findOne({ whatsappPhoneId: bundle.phoneNumberId }).select("_id").lean();
        if (!owner?._id) {
          return;
        }
      }

      if (forcedOwner?.whatsappPhoneId && bundle.phoneNumberId && String(forcedOwner.whatsappPhoneId) !== String(bundle.phoneNumberId)) {
        return;
      }

      await Promise.all(
        bundle.messages.map((item) => createInboundMessage({
          ownerId: owner._id,
          message: item,
          contacts: bundle.contacts
        }))
      );
    })
  );
};

export const verifyWhatsAppWebhook = async (req, res) => {
  const mode = String(req.query["hub.mode"] || "");
  const token = String(req.query["hub.verify_token"] || "");
  const challenge = req.query["hub.challenge"];
  const expectedToken = String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "");
  const webhookPath = String(req.params?.webhookPath || "").trim();

  if (mode !== "subscribe") {
    return res.sendStatus(403);
  }

  if (webhookPath) {
    const user = await findWebhookUser(webhookPath);
    if (user && token && token === String(user.webhookToken || "")) {
      await createWebhookEventLog({
        ownerId: user._id,
        category: "verification",
        level: "success",
        title: "Webhook doğrulaması başarılı",
        content: `Path: ${webhookPath}`,
        requestMethod: "GET",
        sourceUrl: String(req.originalUrl || req.url || "")
      });
      return res.status(200).send(challenge);
    }

    if (user?._id) {
      await createWebhookEventLog({
        ownerId: user._id,
        category: "verification",
        level: "warning",
        title: "Webhook doğrulaması başarısız",
        content: `Path: ${webhookPath}`,
        requestMethod: "GET",
        sourceUrl: String(req.originalUrl || req.url || "")
      });
    }

    return res.sendStatus(403);
  }

  if (expectedToken && token === expectedToken) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

export const receiveWhatsAppWebhook = async (req, res, next) => {
  try {
    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
    const { statuses, incomingMessages } = extractWebhookPayload(entries);
    const webhookPath = String(req.params?.webhookPath || "").trim();
    const webhookUser = await resolveWebhookUser({ webhookPath, entries });

    if (!webhookUser?._id) {
      await UnmatchedWebhookLog.create({
        webhookPath,
        phoneNumberIds: extractWebhookPhoneNumberIds(entries),
        reason: "owner_not_found",
        sourceUrl: String(req.originalUrl || req.url || ""),
        requestMethod: String(req.method || "POST").trim().toUpperCase(),
        requestBody: req.body
      });
      return res.sendStatus(403);
    }

    await createWebhookEventLog({
      ownerId: webhookUser._id,
      category: "incoming",
      level: "info",
      title: "Meta webhook alındı",
      content: buildWebhookEventSummary({ entries, statuses, incomingMessages }),
      requestMethod: "POST",
      sourceUrl: String(req.originalUrl || req.url || ""),
      requestBody: req.body
    });

    if (webhookUser?.relayWebhookUrl) {
      try {
        const relayResult = await relayWhatsAppWebhook({
          targetUrl: webhookUser.relayWebhookUrl,
          verifyToken: webhookUser.relayWebhookVerifyToken || "",
          payload: req.body,
          sourceHeaders: req.headers
        });

        await createWebhookEventLog({
          ownerId: webhookUser._id,
          category: "relay",
          level: "success",
          title: "Webhook dış sisteme iletildi",
          content: `Relay URL: ${webhookUser.relayWebhookUrl}`,
          requestMethod: "POST",
          sourceUrl: String(req.originalUrl || req.url || ""),
          targetUrl: webhookUser.relayWebhookUrl,
          requestBody: req.body,
          responseStatus: relayResult?.status || 200,
          responseBody: relayResult?.responseText || ""
        });
      } catch {
        await createWebhookEventLog({
          ownerId: webhookUser._id,
          category: "relay",
          level: "error",
          title: "Webhook relay başarısız",
          content: `Relay URL: ${webhookUser.relayWebhookUrl}`,
          requestMethod: "POST",
          sourceUrl: String(req.originalUrl || req.url || ""),
          targetUrl: webhookUser.relayWebhookUrl,
          requestBody: req.body
        });
        return res.status(502).json({
          message: "relay webhook delivery failed"
        });
      }

      return res.sendStatus(200);
    }

    await updateMessageStatuses(statuses, webhookUser?._id || null);
    await processIncomingMessages(incomingMessages, webhookUser);

    if (webhookUser?._id) {
      await createWebhookEventLog({
        ownerId: webhookUser._id,
        category: "processing",
        level: "success",
        title: "Webhook yerel olarak işlendi",
        content: `Status: ${statuses.length}, Message bundle: ${incomingMessages.length}`,
        requestMethod: "POST",
        sourceUrl: String(req.originalUrl || req.url || ""),
        requestBody: req.body
      });
    }

    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
};
