import SystemSettings from "../models/system-settings.model.js";

const GLOBAL_KEY = "global";

const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

const normalizeBaseUrl = (value = "") => String(value || "").trim().replace(/\/$/, "");

const normalizeWebhookBaseUrl = (value = "") => {
  const normalized = normalizeBaseUrl(value);

  if (!normalized) {
    return "";
  }

  try {
    const parsed = new URL(normalized);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }

    if (parsed.protocol === "http:" && !LOCALHOST_HOSTNAMES.has(parsed.hostname)) {
      parsed.protocol = "https:";
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

export const getSystemSettings = async () => {
  return SystemSettings.findOneAndUpdate(
    { key: GLOBAL_KEY },
    { $setOnInsert: { key: GLOBAL_KEY, webhookBaseUrl: "" } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

export const getWebhookBaseUrl = async (requestBaseUrl = "") => {
  const settings = await getSystemSettings();
  return (
    normalizeWebhookBaseUrl(settings.webhookBaseUrl) ||
    normalizeWebhookBaseUrl(process.env.WEBHOOK_BASE_URL || "") ||
    normalizeWebhookBaseUrl(requestBaseUrl)
  );
};

export const updateWebhookBaseUrl = async (webhookBaseUrl = "") => {
  const normalized = normalizeWebhookBaseUrl(webhookBaseUrl);
  return SystemSettings.findOneAndUpdate(
    { key: GLOBAL_KEY },
    { $set: { webhookBaseUrl: normalized } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};
