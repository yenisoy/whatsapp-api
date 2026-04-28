import WebhookEventLog from "../models/webhook-event-log.model.js";

const stringifyContent = (value = "") => {
  if (typeof value === "string") {
    return value.trim();
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value || "").trim();
  }
};

export const createWebhookEventLog = async ({
  ownerId,
  category = "incoming",
  level = "info",
  title = "Webhook event",
  content = "",
  sourceUrl = "",
  targetUrl = "",
  requestMethod = "POST",
  responseStatus = null,
  requestBody = null,
  responseBody = "",
  relatedProviderMessageId = ""
} = {}) => {
  if (!ownerId) {
    return null;
  }

  return WebhookEventLog.create({
    ownerId,
    category,
    level,
    title: String(title || "Webhook event").trim(),
    content: stringifyContent(content),
    sourceUrl: String(sourceUrl || "").trim(),
    targetUrl: String(targetUrl || "").trim(),
    requestMethod: String(requestMethod || "").trim().toUpperCase(),
    responseStatus,
    requestBody,
    responseBody: stringifyContent(responseBody),
    relatedProviderMessageId: String(relatedProviderMessageId || "").trim()
  });
};

export const buildWebhookEventSummary = ({ entries = [], statuses = [], incomingMessages = [] } = {}) => {
  const messageCount = incomingMessages.reduce((sum, bundle) => sum + (Array.isArray(bundle?.messages) ? bundle.messages.length : 0), 0);

  return stringifyContent({
    entryCount: Array.isArray(entries) ? entries.length : 0,
    statusCount: Array.isArray(statuses) ? statuses.length : 0,
    bundleCount: Array.isArray(incomingMessages) ? incomingMessages.length : 0,
    messageCount
  });
};