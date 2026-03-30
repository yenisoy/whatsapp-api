import Message from "../models/message.model.js";
import { sendWhatsAppTemplate, sendWhatsAppText } from "./whatsapp.service.js";
import { renderTemplate } from "../utils/render-template.js";
import { extractTemplateVariables } from "../utils/template-variables.js";

const normalizePhone = (phone) => String(phone || "").replaceAll(/\D/g, "").trim();

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

const buildMessageLog = async ({ ownerId, phone, contactId = null, templateId, variables, status, error = "", providerMessageId = "", mediaUrl = "", providerRequestUrl = "", providerRequestBody = null }) => {
  return Message.create({
    ownerId,
    phone,
    contactId,
    templateId,
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
            link: String(mediaUrl || "").trim()
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

export const sendWithTemplate = async ({ ownerId, phone, contactId = null, template, variables = {}, mediaUrl = "", credentials = {} }) => {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    throw new Error("phone is required");
  }

  const headerType = String(template?.headerType || "none").toLowerCase();
  const isMediaTemplate = ["image", "video", "document"].includes(headerType);

  if (isMediaTemplate && !String(mediaUrl || "").trim()) {
    throw new Error("mediaUrl is required for media header templates");
  }

  if (isMediaTemplate) {
    const metaTemplateName = String(template?.metaTemplateName || "").trim();

    if (!metaTemplateName) {
      const log = await buildMessageLog({
        ownerId,
        phone: normalizedPhone,
        contactId,
        templateId: template._id,
        variables,
        status: "failed",
        error: "media header template must be published to Meta before sending",
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
      components: buildTemplateComponents({ template, variables, mediaUrl }),
      credentials
    });

    if (!templateResult.success) {
      const error = templateResult.error || "template send failed";
      const log = await buildMessageLog({
        ownerId,
        phone: normalizedPhone,
        contactId,
        templateId: template._id,
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

    const log = await buildMessageLog({
      ownerId,
      phone: normalizedPhone,
      contactId,
      templateId: template._id,
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
  }

  const text = renderTemplate(template.content, variables);
  const sendResult = await sendWhatsAppText({
    phone: normalizedPhone,
    text,
    credentials
  });

  const status = toLocalLogStatus({
    success: sendResult.success,
    mode: sendResult.mode,
    providerStatus: sendResult.providerStatus
  });
  const error = sendResult.success ? "" : sendResult.error || "unknown error";

  const log = await buildMessageLog({
    ownerId,
    phone: normalizedPhone,
    contactId,
    templateId: template._id,
    variables,
    status,
    error,
    providerMessageId: sendResult.providerMessageId || "",
    mediaUrl: "",
    providerRequestUrl: sendResult.providerRequestUrl || "",
    providerRequestBody: sendResult.providerRequestBody || null
  });

  log.providerStatus = sendResult.providerStatus || "";
  await log.save();

  return {
    success: sendResult.success,
    mode: sendResult.mode,
    providerStatus: sendResult.providerStatus || "",
    log
  };
};
