const RELAY_TIMEOUT_MS = 15000;

export const relayWhatsAppWebhook = async ({ targetUrl = "", verifyToken = "", payload = null, sourceHeaders = {} } = {}) => {
  const normalizedTargetUrl = String(targetUrl || "").trim();

  if (!normalizedTargetUrl) {
    return { success: false, skipped: true };
  }

  const headers = {
    "Content-Type": "application/json",
    "X-Relay-Source": "whatsapp-meta",
    "X-Relay-Verify-Token": String(verifyToken || "").trim()
  };

  const forwardedSignature = String(sourceHeaders?.["x-hub-signature-256"] || "").trim();
  const forwardedUserAgent = String(sourceHeaders?.["user-agent"] || "").trim();

  if (forwardedSignature) {
    headers["X-Hub-Signature-256"] = forwardedSignature;
  }

  if (forwardedUserAgent) {
    headers["User-Agent"] = forwardedUserAgent;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);

  try {
    const response = await fetch(normalizedTargetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload ?? {}),
      signal: controller.signal
    });

    const responseText = await response.text().catch(() => "");

    if (!response.ok) {
      throw new Error(responseText || `Relay request failed with ${response.status}`);
    }

    return {
      success: true,
      status: response.status,
      responseText
    };
  } finally {
    clearTimeout(timeoutId);
  }
};