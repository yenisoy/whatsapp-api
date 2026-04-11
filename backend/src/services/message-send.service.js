import Message from "../models/message.model.js";
import { sendWhatsAppTemplate } from "./whatsapp.service.js";
import { extractTemplateVariables } from "../utils/template-variables.js";
import { resolvePublicMediaUrl } from "../utils/user-media-storage.js";
import { renderTemplate } from "../utils/render-template.js";
import { normalizePhone, resolveContactName, upsertConversationByPhone } from "./conversation.service.js";

const toLocalLogStatus = ({ success, mode, providerStatus = "" }) => {
  if (!success) {
    return "failed";
  }

  if (mode === "cloud") {
    const normalized = String(providerStatus || "").trim().toLowerCase();
    if (["accepted", "held_for_quality_assessment", "pending"].includes(normalized)) {
      return "queued";
    }
  }

  return "sent";
};

const buildMessageLog = async ({ ownerId, phone, contactId = null, conversationId = null, templateId = null, variables, status, error = "", providerMessageId = "", mediaUrl = "", providerRequestUrl = "", providerRequestBody = null, direction = "outbound", messageType = "template", body = "" }) => {
  return Message.create({
    ownerId,
    phone,
    contactId,
    conversationId,
    templateId,
    direction,
    messageType,
    body,
    variables,
    status,
    error,
    providerMessageId,
    providerRequestUrl: String(providerRequestUrl || "").trim(),
    providerRequestBody,
    mediaUrl: String(mediaUrl || "").trim(),
    providerStatus: status === "sent" ? "sent" : status
  });
};

const toTextParameter = (value) => ({
  type: "text",
  text: String(value ?? "")
});

const buildTemplateComponents = ({ template, variables = {}, mediaUrl = "" }) => {
  const components = [];
  const headerType = String(template?.headerType || "none").toLowerCase();

  if (["image", "video", "document"].includes(headerType)) {
    components.push({
      type: "header",
      parameters: [
        {
          type: headerType,
          [headerType]: {
            link: resolvePublicMediaUrl(mediaUrl)
          }
        }
      ]
    });
  } else if (headerType === "text") {
    const headerVariables = extractTemplateVariables(template?.headerText || "");
    if (headerVariables.length) {
      components.push({
        type: "header",
        parameters: headerVariables.map((name) => toTextParameter(variables?.[name]))
      });
    }
  }

  const bodyVariables = extractTemplateVariables(template?.content || "");
  if (bodyVariables.length) {
    components.push({
      type: "body",
      parameters: bodyVariables.map((name) => toTextParameter(variables?.[name]))
    });
  }

  return components;
};

export const sendWithTemplate = async ({ ownerId, phone, contactId = null, template, variables = {}, mediaUrl = "", publicBaseUrl = "", credentials = {} }) => {
  const normalizedPhone = normalizePhone(phone);
  const renderedBody = renderTemplate(template?.content || "", variables);

  if (!normalizedPhone) {
    throw new Error("phone is required");
  }

  const headerType = String(template?.headerType || "none").toLowerCase();
  const isMediaTemplate = ["image", "video", "document"].includes(headerType);

  if (isMediaTemplate && !String(mediaUrl || "").trim()) {
    throw new Error("mediaUrl is required for media header templates");
  }

  const resolvedMediaUrl = resolvePublicMediaUrl(mediaUrl, publicBaseUrl);

  if (isMediaTemplate && !String(resolvedMediaUrl || "").trim()) {
    throw new Error("mediaUrl could not be resolved to a public URL");
  }

  if (isMediaTemplate && !/^https?:\/\//i.test(resolvedMediaUrl)) {
    throw new Error("mediaUrl must be a publicly reachable absolute URL for WhatsApp media templates");
  }

  const metaTemplateName = String(template?.metaTemplateName || template?.name || "").trim();

  if (!metaTemplateName) {
    const contactName = await resolveContactName({ ownerId, phone: normalizedPhone });
    const conversation = await upsertConversationByPhone({
      ownerId,
      phone: normalizedPhone,
      contactName,
      direction: "outbound",
      messageType: "template",
      messageText: renderedBody,
      incrementUnread: false
    });

    const log = await buildMessageLog({
      ownerId,
      phone: normalizedPhone,
      contactId,
      templateId: template._id,
      conversationId: conversation?._id || null,
      direction: "outbound",
      messageType: "template",
      body: renderedBody,
      variables,
      status: "failed",
      error: "template name is missing or invalid",
      providerMessageId: "",
      mediaUrl
    });

    return {
      success: false,
      mode: "local",
      log
    };
  }

  const templateResult = await sendWhatsAppTemplate({
    phone: normalizedPhone,
    templateName: metaTemplateName,
    language: template?.language || "tr",
    components: buildTemplateComponents({ template, variables, mediaUrl: resolvedMediaUrl }),
    credentials
  });

  if (!templateResult.success) {
    const error = templateResult.error || "template send failed";
    const contactName = await resolveContactName({ ownerId, phone: normalizedPhone });
    const conversation = await upsertConversationByPhone({
      ownerId,
      phone: normalizedPhone,
      contactName,
      direction: "outbound",
      messageType: "template",
      messageText: renderedBody,
      incrementUnread: false
    });

    const log = await buildMessageLog({
      ownerId,
      phone: normalizedPhone,
      contactId,
      templateId: template._id,
      conversationId: conversation?._id || null,
      direction: "outbound",
      messageType: "template",
      body: renderedBody,
      variables,
      status: "failed",
      error,
      providerMessageId: templateResult.providerMessageId || "",
      mediaUrl,
      providerRequestUrl: templateResult.providerRequestUrl || "",
      providerRequestBody: templateResult.providerRequestBody || null
    });

    return {
      success: false,
      mode: templateResult.mode,
      log
    };
  }

  const contactName = await resolveContactName({ ownerId, phone: normalizedPhone });
  const conversation = await upsertConversationByPhone({
    ownerId,
    phone: normalizedPhone,
    contactName,
    direction: "outbound",
    messageType: "template",
    messageText: renderedBody,
    incrementUnread: false
  });

  const log = await buildMessageLog({
    ownerId,
    phone: normalizedPhone,
    contactId,
    templateId: template._id,
    conversationId: conversation?._id || null,
    direction: "outbound",
    messageType: "template",
    body: renderedBody,
    variables,
    status: toLocalLogStatus({
      success: true,
      mode: templateResult.mode,
      providerStatus: templateResult.providerStatus
    }),
    error: "",
    providerMessageId: templateResult.providerMessageId || "",
    mediaUrl,
    providerRequestUrl: templateResult.providerRequestUrl || "",
    providerRequestBody: templateResult.providerRequestBody || null
  });

  log.providerStatus = templateResult.providerStatus || "";
  await log.save();

  return {
    success: true,
    mode: templateResult.mode,
    providerStatus: templateResult.providerStatus || "",
    log
  };
};
