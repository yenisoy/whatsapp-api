import Message from "../models/message.model.js";

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

export const verifyWhatsAppWebhook = async (req, res) => {
  const mode = String(req.query["hub.mode"] || "");
  const token = String(req.query["hub.verify_token"] || "");
  const challenge = req.query["hub.challenge"];
  const expectedToken = String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "");

  if (mode === "subscribe" && expectedToken && token === expectedToken) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

export const receiveWhatsAppWebhook = async (req, res, next) => {
  try {
    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
    const statuses = [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const changeStatuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];
        statuses.push(...changeStatuses);
      }
    }

    await Promise.all(
      statuses.map(async (item) => {
        const providerMessageId = String(item?.id || "").trim();
        const providerStatus = String(item?.status || "").trim().toLowerCase();
        const localStatus = mapProviderStatusToLocalStatus(providerStatus);
        const providerError = item?.errors?.[0]?.title || item?.errors?.[0]?.message || "";

        if (!providerMessageId) {
          return;
        }

        const updatePayload = {
          providerStatus,
          status: localStatus
        };

        if (providerError) {
          updatePayload.error = String(providerError);
        }

        await Message.findOneAndUpdate(
          { providerMessageId },
          updatePayload,
          { sort: { createdAt: -1 } }
        );
      })
    );

    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
};
