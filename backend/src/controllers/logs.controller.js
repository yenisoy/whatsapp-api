import Message from "../models/message.model.js";
import UnmatchedWebhookLog from "../models/unmatched-webhook-log.model.js";
import WebhookEventLog from "../models/webhook-event-log.model.js";

const getMessageStatusLabel = ({ direction = "outbound", status = "" } = {}) => {
  const normalizedDirection = String(direction || "outbound").toLowerCase();
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedDirection === "inbound") {
    return "Gelen mesaj";
  }

  if (normalizedStatus === "read") {
    return "Okundu";
  }

  if (normalizedStatus === "delivered") {
    return "Teslim edildi";
  }

  if (normalizedStatus === "sent") {
    return "Gönderildi";
  }

  if (normalizedStatus === "failed") {
    return "Başarısız";
  }

  if (normalizedStatus === "queued") {
    return "Kuyrukta";
  }

  return "Mesaj";
};

const describeMessageLog = (message = {}) => {
  const direction = String(message.direction || "outbound").toLowerCase();
  const status = String(message.status || "").toLowerCase();
  const phone = String(message.phone || "").trim();
  const body = String(message.body || "").trim();
  const error = String(message.error || "").trim();

  let title = "Giden mesaj";
  if (direction === "inbound") {
    title = "Gelen mesaj";
  } else if (status === "failed") {
    title = "Mesaj gönderimi başarısız";
  }

  let level = "success";
  if (status === "failed") {
    level = "error";
  } else if (direction === "inbound") {
    level = "info";
  }

  const content = status === "failed"
    ? [
        error ? `Hata: ${error}` : "Hata: -",
        body ? `Mesaj: ${body}` : null,
        String(message.providerMessageId || "").trim() ? `Provider ID: ${String(message.providerMessageId || "").trim()}` : null
      ].filter(Boolean).join("\n")
    : body || String(message.providerMessageId || "").trim() || "-";

  return {
    _id: String(message._id),
    kind: "message",
    category: direction,
    level,
    title,
    statusLabel: getMessageStatusLabel({ direction, status }),
    content,
    source: direction === "inbound" ? "WhatsApp" : "Sistem",
    target: phone,
    status: status || "queued",
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    raw: message
  };
};

const describeWebhookLog = (event = {}) => ({
  _id: String(event._id),
  kind: "webhook",
  category: String(event.category || "incoming"),
  level: String(event.level || "info"),
  title: event.title || "Webhook olayı",
  content: event.requestBody
    ? [
        `İstek tipi: ${String(event.requestMethod || "POST").trim().toUpperCase()}`,
        "Gelen veri:",
        typeof event.requestBody === "string"
          ? event.requestBody
          : JSON.stringify(event.requestBody, null, 2)
      ].join("\n")
    : event.content || "-",
  source: event.sourceUrl || "-",
  target: event.targetUrl || "-",
  status: event.responseStatus ? String(event.responseStatus) : "-",
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
  raw: event
});

export const getLogs = async (req, res, next) => {
  try {
    const { status, phone, templateId, limit = 100 } = req.query;
    const filter = {
      ownerId: req.user.id
    };

    const eventFilter = {
      ownerId: req.user.id
    };

    if (status) {
      filter.status = status;
      eventFilter.level = status;
    }

    if (phone) {
      filter.phone = { $regex: String(phone), $options: "i" };
      eventFilter.$or = [
        { title: { $regex: String(phone), $options: "i" } },
        { content: { $regex: String(phone), $options: "i" } },
        { sourceUrl: { $regex: String(phone), $options: "i" } },
        { targetUrl: { $regex: String(phone), $options: "i" } }
      ];
    }

    if (templateId) {
      filter.templateId = templateId;
    }

    const parsedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const [messages, events] = await Promise.all([
      Message.find(filter)
        .populate("templateId", "name language status")
        .sort({ createdAt: -1 })
        .limit(parsedLimit)
        .lean(),
      WebhookEventLog.find(eventFilter)
        .sort({ createdAt: -1 })
        .limit(parsedLimit)
        .lean()
    ]);

    const normalized = [
      ...messages.map(describeMessageLog),
      ...events.map(describeWebhookLog)
    ].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
      .slice(0, parsedLimit);

    return res.json(normalized);
  } catch (error) {
    return next(error);
  }
};

export const getLogStats = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    const [totalMessages, sentMessages, failedMessages, webhookEvents] = await Promise.all([
      Message.countDocuments({ ownerId }),
      Message.countDocuments({ ownerId, status: "sent" }),
      Message.countDocuments({ ownerId, status: "failed" }),
      WebhookEventLog.countDocuments({ ownerId })
    ]);

    const successRate = totalMessages > 0
      ? Math.round((sentMessages / totalMessages) * 100)
      : 0;

    return res.json({
      totalMessages,
      sentMessages,
      failedMessages,
      webhookEvents,
      successRate
    });
  } catch (error) {
    return next(error);
  }
};

export const getUnmatchedWebhookLogs = async (req, res, next) => {
  try {
    const { limit = 200 } = req.query;
    const parsedLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);

    const logs = await UnmatchedWebhookLog.find({})
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .lean();

    return res.json(logs);
  } catch (error) {
    return next(error);
  }
};