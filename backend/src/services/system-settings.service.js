import SystemSettings from "../models/system-settings.model.js";

const GLOBAL_KEY = "global";

const normalizeBaseUrl = (value = "") => String(value || "").trim().replace(/\/$/, "");

export const getSystemSettings = async () => {
  return SystemSettings.findOneAndUpdate(
    { key: GLOBAL_KEY },
    { $setOnInsert: { key: GLOBAL_KEY, webhookBaseUrl: "" } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

export const getWebhookBaseUrl = async (requestBaseUrl = "") => {
  const settings = await getSystemSettings();
  return normalizeBaseUrl(settings.webhookBaseUrl) || normalizeBaseUrl(process.env.WEBHOOK_BASE_URL || "") || normalizeBaseUrl(requestBaseUrl);
};

export const updateWebhookBaseUrl = async (webhookBaseUrl = "") => {
  const normalized = normalizeBaseUrl(webhookBaseUrl);
  return SystemSettings.findOneAndUpdate(
    { key: GLOBAL_KEY },
    { $set: { webhookBaseUrl: normalized } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};
