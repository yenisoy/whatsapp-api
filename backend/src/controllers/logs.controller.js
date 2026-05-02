import Message from "../models/message.model.js";
import mongoose from "mongoose";
import xlsx from "xlsx";
import UnmatchedWebhookLog from "../models/unmatched-webhook-log.model.js";
import WebhookEventLog from "../models/webhook-event-log.model.js";

const phoneStatusExportHeaders = ["phone", "status", "statusLabelTr", "descriptionTr", "updatedAt", "providerMessageId"];

const escapeCsvValue = (value = "") => {
  const normalized = String(value ?? "");
  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replaceAll("\"", "\"\"")}"`;
};

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

const toLocalStatusFromProvider = (providerStatus = "") => {
  const normalized = String(providerStatus || "").trim().toLowerCase();

  if (["sent", "delivered", "read", "failed", "queued"].includes(normalized)) {
    return normalized;
  }

  if (["accepted", "held_for_quality_assessment", "pending"].includes(normalized)) {
    return "queued";
  }

  if (["undeliverable", "deleted"].includes(normalized)) {
    return "failed";
  }

  return "";
};

const parseJsonMaybe = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const extractWebhookStatusRows = (requestBody) => {
  const payload = parseJsonMaybe(requestBody);
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  return entries.flatMap((entry) => {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    return changes.flatMap((change) => {
      const statuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];

      return statuses.map((item) => {
        const providerStatus = String(item?.status || "").trim().toLowerCase();
        const phone = String(item?.recipient_id || item?.wa_id || "").trim();

        return {
          phone,
          providerStatus,
          providerMessageId: String(item?.id || "").trim(),
          updatedAt: item?.timestamp ? new Date(Number(item.timestamp) * 1000) : null
        };
      }).filter((item) => item.phone);
    });
  });
};

const findLatestPhoneStatusesFromLogs = async ({ ownerId = "", q = "", limit = 500 } = {}) => {
  const ownerObjectId = new mongoose.Types.ObjectId(String(ownerId || "").trim());
  const parsedLimit = Math.min(Math.max(Number(limit) || 500, 1), 2000);
  const phoneQuery = String(q || "").trim();

  const logFilter = {
    ownerId: ownerObjectId,
    title: "Meta webhook alındı"
  };

  if (phoneQuery) {
    logFilter.$or = [
      { content: { $regex: phoneQuery, $options: "i" } },
      { sourceUrl: { $regex: phoneQuery, $options: "i" } },
      { targetUrl: { $regex: phoneQuery, $options: "i" } }
    ];
  }

  const logs = await WebhookEventLog.find(logFilter)
    .sort({ createdAt: -1 })
    .limit(parsedLimit)
    .lean();

  const latestByPhone = new Map();

  logs.forEach((log) => {
    const rows = extractWebhookStatusRows(log.requestBody);

    rows.forEach((row) => {
      if (!row.phone) {
        return;
      }

      if (phoneQuery && !row.phone.includes(phoneQuery)) {
        return;
      }

      const current = latestByPhone.get(row.phone);
      const nextTime = new Date(log.createdAt || row.updatedAt || 0).getTime();
      const currentTime = current ? new Date(current.updatedAt || current.createdAt || 0).getTime() : -1;

      if (!current || nextTime >= currentTime) {
        const effectiveStatus = toLocalStatusFromProvider(row.providerStatus) || "queued";

        latestByPhone.set(row.phone, {
          _id: String(log._id || ""),
          phone: row.phone,
          status: effectiveStatus,
          statusLabelTr: toTurkishStatus(effectiveStatus),
          descriptionTr: buildStatusDescription({
            status: effectiveStatus,
            providerStatus: row.providerStatus
          }),
          error: "",
          providerMessageId: row.providerMessageId,
          updatedAt: row.updatedAt || log.createdAt,
          createdAt: log.createdAt,
          sourceTitle: log.title || "Meta webhook alındı"
        });
      }
    });
  });

  return Array.from(latestByPhone.values())
    .sort((first, second) => new Date(second.updatedAt || second.createdAt || 0).getTime() - new Date(first.updatedAt || first.createdAt || 0).getTime())
    .slice(0, parsedLimit);
};

const findLatestPhoneStatuses = async ({ ownerId = "", q = "", limit = 500 } = {}) => {
  const ownerObjectId = new mongoose.Types.ObjectId(String(ownerId || "").trim());
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

  return latestPerPhone.map((item) => {
    const status = String(item?.status || "").trim().toLowerCase();
    const providerStatus = String(item?.providerStatus || "").trim().toLowerCase();
    const effectiveStatus = status || toLocalStatusFromProvider(providerStatus) || "queued";

    return {
      _id: String(item?._id || ""),
      phone: String(item?.phone || "").trim(),
      status: effectiveStatus,
      statusLabelTr: toTurkishStatus(effectiveStatus),
      descriptionTr: buildStatusDescription({
        status: effectiveStatus,
        error: item?.error || "",
        providerStatus
      }),
      error: String(item?.error || "").trim(),
      providerMessageId: String(item?.providerMessageId || "").trim(),
      updatedAt: item?.updatedAt,
      createdAt: item?.createdAt
    };
  });
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
    const { q = "", limit = 500 } = req.query;
    const response = await findLatestPhoneStatusesFromLogs({
      ownerId: req.user.id,
      q,
      limit
    });

    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

export const exportLatestPhoneStatuses = async (req, res, next) => {
  try {
    const format = String(req.query.format || "xlsx").toLowerCase();
    const response = await findLatestPhoneStatusesFromLogs({
      ownerId: req.user.id,
      q: req.query.q,
      limit: req.query.limit || 2000
    });

    const rows = response.map((item) => ({
      phone: item.phone,
      status: item.status,
      statusLabelTr: item.statusLabelTr,
      descriptionTr: item.descriptionTr,
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : "",
      providerMessageId: item.providerMessageId
    }));

    if (format === "xlsx" || format === "xls") {
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.json_to_sheet(rows, {
        header: phoneStatusExportHeaders
      });
      xlsx.utils.book_append_sheet(workbook, worksheet, "phone_statuses");

      const buffer = xlsx.write(workbook, {
        type: "buffer",
        bookType: "xlsx"
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=phone-statuses-export.xlsx"
      );

      return res.status(200).send(buffer);
    }

    const csvHeader = `${phoneStatusExportHeaders.join(",")}\n`;
    const csvBody = rows
      .map((row) => phoneStatusExportHeaders.map((header) => escapeCsvValue(row[header])).join(","))
      .join("\n");
    const csvContent = `${csvHeader}${csvBody}${rows.length ? "\n" : ""}`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=phone-statuses-export.csv"
    );

    return res.status(200).send(csvContent);
  } catch (error) {
    return next(error);
  }
};