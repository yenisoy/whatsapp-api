import Message from "../models/message.model.js";
import mongoose from "mongoose";
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

const toTurkishStatus = (status = "") => {
  const normalizedStatus = String(status || "").trim().toLowerCase();

  if (normalizedStatus === "sent") {
    return "Mesaj gönderildi";
  }

  if (normalizedStatus === "delivered") {
    return "Mesaj teslim edildi";
  }

  if (normalizedStatus === "read") {
    return "Mesaj okundu";
  }

  if (normalizedStatus === "failed") {
    return "Hata";
  }

  if (normalizedStatus === "queued") {
    return "Kuyrukta";
  }

  return "Bilinmiyor";
};

const buildStatusDescription = ({ status = "", error = "", providerStatus = "" } = {}) => {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedError = String(error || "").trim();
  const normalizedProviderStatus = String(providerStatus || "").trim().toLowerCase();

  if (normalizedStatus === "failed") {
    if (normalizedError) {
      return normalizedError;
    }

    if (normalizedProviderStatus) {
      return `WhatsApp hata durumu: ${normalizedProviderStatus}`;
    }

    return "WhatsApp gönderimi başarısız oldu.";
  }

  if (normalizedProviderStatus) {
    return `Son webhook durumu: ${normalizedProviderStatus}`;
  }

  return "-";
};

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

export const getLatestPhoneStatuses = async (req, res, next) => {
  try {
    const ownerId = String(req.user.id || "").trim();
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const { q = "", limit = 500 } = req.query;

    const parsedLimit = Math.min(Math.max(Number(limit) || 500, 1), 2000);
    const phoneQuery = String(q || "").trim();

    const filter = {
      ownerId: ownerObjectId,
      direction: "outbound"
    };

    if (phoneQuery) {
      filter.phone = { $regex: phoneQuery, $options: "i" };
    }

    const latestPerPhone = await Message.aggregate([
      {
        $match: filter
      },
      {
        $sort: {
          updatedAt: -1,
          createdAt: -1
        }
      },
      {
        $group: {
          _id: "$phone",
          latest: { $first: "$$ROOT" }
        }
      },
      {
        $replaceRoot: {
          newRoot: "$latest"
        }
      },
      {
        $sort: {
          updatedAt: -1,
          createdAt: -1
        }
      },
      {
        $limit: parsedLimit
      },
      {
        $project: {
          _id: 1,
          phone: 1,
          status: 1,
          providerStatus: 1,
          error: 1,
          updatedAt: 1,
          createdAt: 1,
          providerMessageId: 1
        }
      }
    ]);

    const response = latestPerPhone.map((item) => {
      const status = String(item?.status || "").trim().toLowerCase();
      const providerStatus = String(item?.providerStatus || "").trim().toLowerCase();
      const effectiveStatus = providerStatus || status;

      return {
        _id: String(item?._id || ""),
        phone: String(item?.phone || "").trim(),
        status: effectiveStatus || "queued",
        statusLabelTr: toTurkishStatus(effectiveStatus || "queued"),
        descriptionTr: buildStatusDescription({
          status: effectiveStatus || "queued",
          error: item?.error || "",
          providerStatus
        }),
        error: String(item?.error || "").trim(),
        providerMessageId: String(item?.providerMessageId || "").trim(),
        updatedAt: item?.updatedAt,
        createdAt: item?.createdAt
      };
    });

    return res.json(response);
  } catch (error) {
    return next(error);
  }
};