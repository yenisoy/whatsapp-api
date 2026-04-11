const ALNUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const randomAlnum = (length = 20) => {
  let output = "";

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * ALNUM.length);
    output += ALNUM[randomIndex];
  }

  return output;
};

export const generateWebhookToken = () => randomAlnum(20);

export const generateWebhookPath = () => randomAlnum(12);

export const ensureUserWebhookCredentials = (user) => {
  let changed = false;

  if (!String(user?.webhookToken || "").trim()) {
    user.webhookToken = generateWebhookToken();
    changed = true;
  }

  if (!String(user?.webhookPath || "").trim()) {
    user.webhookPath = generateWebhookPath();
    changed = true;
  }

  return changed;
};

export const buildUserWebhookUrl = ({ baseUrl = "", webhookPath = "" }) => {
  const normalizedBaseUrl = String(baseUrl || "").trim().replace(/\/$/, "");
  const normalizedPath = String(webhookPath || "").trim();

  if (!normalizedBaseUrl || !normalizedPath) {
    return "";
  }

  return `${normalizedBaseUrl}/webhooks/whatsapp/${normalizedPath}`;
};
