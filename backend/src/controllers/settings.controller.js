import { getSystemSettings, getWebhookBaseUrl, updateWebhookBaseUrl } from "../services/system-settings.service.js";
import { getRequestBaseUrl } from "../utils/user-media-storage.js";

export const getSettings = async (req, res, next) => {
  try {
    const settings = await getSystemSettings();
    const requestBaseUrl = getRequestBaseUrl(req);
    const effectiveWebhookBaseUrl = await getWebhookBaseUrl(requestBaseUrl);

    return res.json({
      webhookBaseUrl: settings.webhookBaseUrl || "",
      effectiveWebhookBaseUrl
    });
  } catch (error) {
    return next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const webhookBaseUrl = String(req.body?.webhookBaseUrl || "").trim();

    if (webhookBaseUrl) {
      try {
        const parsed = new URL(webhookBaseUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return res.status(400).json({ message: "webhookBaseUrl must use http or https" });
        }
      } catch {
        return res.status(400).json({ message: "webhookBaseUrl must be a valid URL" });
      }
    }

    const settings = await updateWebhookBaseUrl(webhookBaseUrl);
    const requestBaseUrl = getRequestBaseUrl(req);
    const effectiveWebhookBaseUrl = await getWebhookBaseUrl(requestBaseUrl);

    return res.json({
      message: "settings updated",
      webhookBaseUrl: settings.webhookBaseUrl || "",
      effectiveWebhookBaseUrl
    });
  } catch (error) {
    return next(error);
  }
};
