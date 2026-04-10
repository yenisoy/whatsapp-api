import Template from "../models/template.model.js";
import {
  fetchAllMetaTemplates,
  fetchMetaTemplateStatus,
  publishTemplateToMeta,
  uploadTemplateMediaToMeta
} from "../services/meta-template.service.js";
import { normalizeLanguageCode } from "../utils/normalize-language-code.js";
import { extractTemplateVariables } from "../utils/template-variables.js";

const mapTemplatePayload = (payload = {}) => {
  const name = String(payload.name || "").trim();
  const language = normalizeLanguageCode(payload.language || "tr");
  const category = String(payload.category || "UTILITY").trim().toUpperCase();
  const headerType = String(payload.headerType || "none").trim().toLowerCase();
  const headerText = String(payload.headerText || "").trim();
  const headerMediaHandle = String(payload.headerMediaHandle || "").trim();
  const footerText = String(payload.footerText || "").trim();
  const content = String(payload.content || "").trim();
  const variables = Array.from(
    new Set([
      ...extractTemplateVariables(content),
      ...extractTemplateVariables(headerText)
    ])
  );

  const allowedCategories = ["MARKETING", "UTILITY", "AUTHENTICATION"];
  const allowedHeaderTypes = ["none", "text", "image", "video", "document"];

  const normalizedCategory = allowedCategories.includes(category) ? category : "UTILITY";
  const normalizedHeaderType = allowedHeaderTypes.includes(headerType) ? headerType : "none";

  return {
    name,
    language,
    category: normalizedCategory,
    headerType: normalizedHeaderType,
    headerText,
    headerMediaHandle,
    footerText,
    content,
    variables
  };
};

const getLocalStatusFromMetaStatus = (metaStatus = "") => {
  const normalized = String(metaStatus || "").trim().toUpperCase();

  if (normalized === "APPROVED") {
    return "approved";
  }

  if (["REJECTED", "PAUSED", "DISABLED", "DELETED"].includes(normalized)) {
    return "rejected";
  }

  return "pending";
};

const normalizeTemplateLanguage = (language = "") => {
  return normalizeLanguageCode(language || "tr");
};

const extractMetaBodyText = (components = []) => {
  const list = Array.isArray(components) ? components : [];
  const body = list.find((component) => String(component?.type || "").toUpperCase() === "BODY");
  return String(body?.text || "").trim();
};

const extractMetaComponent = (components = [], type = "") => {
  const list = Array.isArray(components) ? components : [];
  const normalizedType = String(type || "").toUpperCase();
  return list.find((component) => String(component?.type || "").toUpperCase() === normalizedType) || null;
};

const parseMetaCreatedAt = (value = "") => {
  const createdAt = String(value || "").trim();
  if (!createdAt) {
    return null;
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const syncTemplateFromMeta = async (template, credentials = {}) => {
  if (!template || (!template.metaTemplateId && !template.metaTemplateName)) {
    return template;
  }

  const result = await fetchMetaTemplateStatus({
    metaTemplateId: template.metaTemplateId,
    metaTemplateName: template.metaTemplateName,
    credentials
  });

  template.metaTemplateId = result.id || template.metaTemplateId;
  template.metaTemplateName = result.name || template.metaTemplateName;
  template.metaStatus = result.status || template.metaStatus;
  template.metaCategory = result.category || template.metaCategory;
  template.metaCreatedAt = parseMetaCreatedAt(result.createdTime) || template.metaCreatedAt;
  template.status = getLocalStatusFromMetaStatus(template.metaStatus);
  template.metaLastSyncAt = new Date();
  template.metaError = "";
  await template.save();

  return template;
};

export const createTemplate = async (req, res, next) => {
  try {
    const payload = mapTemplatePayload(req.body);
    const shouldPublishToMeta = req.body?.publishToMeta !== false && String(req.body?.publishToMeta || "").toLowerCase() !== "false";

    if (!payload.name || !payload.content) {
      return res.status(400).json({ message: "name and content are required" });
    }

    if (payload.headerType === "text" && !payload.headerText) {
      return res.status(400).json({ message: "headerText is required when headerType is text" });
    }

    if (shouldPublishToMeta && ["image", "video", "document"].includes(payload.headerType) && !payload.headerMediaHandle) {
      return res.status(400).json({ message: "headerMediaHandle is required for media header types" });
    }

    const created = await Template.create({
      ...payload,
      ownerId: req.user.id,
      status: "pending"
    });

    if (!shouldPublishToMeta) {
      return res.status(201).json({
        message: "template created locally (meta publish skipped)",
        template: created
      });
    }

    try {
      const result = await publishTemplateToMeta({
        name: created.name,
        language: created.language,
        content: created.content,
        category: created.category,
        headerType: created.headerType,
        headerText: created.headerText,
        headerMediaHandle: created.headerMediaHandle,
        footerText: created.footerText,
        credentials: {
          whatsappToken: req.user?.whatsappToken,
          whatsappBusinessAccountId: req.user?.whatsappBusinessAccountId
        }
      });

      created.metaTemplateId = result.id;
      created.metaTemplateName = result.name;
      created.metaStatus = result.status || "PENDING";
      created.metaCategory = result.category;
      created.status = getLocalStatusFromMetaStatus(created.metaStatus);
      created.metaLastSyncAt = new Date();
      created.metaError = "";
      await created.save();

      return res.status(201).json({
        message: "template created and auto-published to meta",
        template: created
      });
    } catch (error) {
      const errorPayload = error.response?.data;
      created.metaLastSyncAt = new Date();
      created.metaError = errorPayload?.error?.message || error.message;
      await created.save();

      return res.status(201).json({
        message: "template created but auto-publish failed",
        error: created.metaError,
        template: created
      });
    }
  } catch (error) {
    return next(error);
  }
};

export const getTemplates = async (req, res, next) => {
  try {
    const { status, language, q, syncMeta } = req.query;
    const filter = {
      ownerId: req.user.id
    };

    if (status) {
      filter.status = status;
    }

    if (language) {
      filter.language = language;
    }

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { content: { $regex: q, $options: "i" } }
      ];
    }

    const templates = await Template.find(filter).sort({ createdAt: -1 });

    const shouldSyncMeta = syncMeta === undefined || String(syncMeta || "").toLowerCase() === "true";

    if (shouldSyncMeta) {
      await Promise.all(
        templates.map(async (template) => {
          if (!template.metaTemplateId && !template.metaTemplateName) {
            return;
          }

          try {
            await syncTemplateFromMeta(template, {
              whatsappToken: req.user?.whatsappToken,
              whatsappBusinessAccountId: req.user?.whatsappBusinessAccountId
            });
          } catch (error) {
            template.metaLastSyncAt = new Date();
            template.metaError = error.response?.data?.error?.message || error.message;
            await template.save();
          }
        })
      );
    }

    return res.json(templates);
  } catch (error) {
    return next(error);
  }
};

export const deleteTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await Template.findOneAndDelete({
      _id: id,
      ownerId: req.user.id
    });

    if (!deleted) {
      return res.status(404).json({ message: "template not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

export const previewTemplateVariables = async (req, res, next) => {
  try {
    const content = String(req.body.content || "");
    const variables = extractTemplateVariables(content);
    return res.json({ variables });
  } catch (error) {
    return next(error);
  }
};

export const publishTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = String(req.body?.category || "MARKETING").toUpperCase();
    const allowedCategories = ["MARKETING", "UTILITY", "AUTHENTICATION"];

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ message: "category must be MARKETING, UTILITY or AUTHENTICATION" });
    }

    const template = await Template.findOne({ _id: id, ownerId: req.user.id });
    if (!template) {
      return res.status(404).json({ message: "template not found" });
    }

    try {
      const result = await publishTemplateToMeta({
        name: template.name,
        language: template.language,
        content: template.content,
        category,
        headerType: template.headerType,
        headerText: template.headerText,
        headerMediaHandle: template.headerMediaHandle,
        footerText: template.footerText,
        credentials: {
          whatsappToken: req.user?.whatsappToken,
          whatsappBusinessAccountId: req.user?.whatsappBusinessAccountId
        }
      });

      template.metaTemplateId = result.id;
      template.metaTemplateName = result.name;
      template.metaStatus = result.status || "PENDING";
      template.metaCategory = result.category;
      template.status = getLocalStatusFromMetaStatus(template.metaStatus);
      template.metaLastSyncAt = new Date();
      template.metaError = "";
      await template.save();

      return res.json({
        message: "template published to meta",
        template
      });
    } catch (error) {
      const errorPayload = error.response?.data;
      const message = errorPayload?.error?.message || error.message;
      template.metaLastSyncAt = new Date();
      template.metaError = message;
      await template.save();

      return res.status(502).json({
        message: "meta publish failed",
        error: template.metaError,
        errorDetails: errorPayload || null,
        template
      });
    }
  } catch (error) {
    return next(error);
  }
};

export const syncTemplateMetaStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await Template.findOne({ _id: id, ownerId: req.user.id });

    if (!template) {
      return res.status(404).json({ message: "template not found" });
    }

    if (!template.metaTemplateId && !template.metaTemplateName) {
      return res.status(400).json({ message: "template has no meta reference yet" });
    }

    try {
      await syncTemplateFromMeta(template, {
        whatsappToken: req.user?.whatsappToken,
        whatsappBusinessAccountId: req.user?.whatsappBusinessAccountId
      });
      return res.json({
        message: "meta status synced",
        template
      });
    } catch (error) {
      const errorPayload = error.response?.data;
      template.metaLastSyncAt = new Date();
      template.metaError = errorPayload?.error?.message || error.message;
      await template.save();

      return res.status(502).json({
        message: "meta sync failed",
        error: template.metaError,
        errorDetails: errorPayload || null,
        template
      });
    }
  } catch (error) {
    return next(error);
  }
};

export const importTemplatesFromMeta = async (req, res, next) => {
  try {
    const credentials = {
      whatsappToken: req.user?.whatsappToken,
      whatsappBusinessAccountId: req.user?.whatsappBusinessAccountId
    };

    const metaTemplates = await fetchAllMetaTemplates({ credentials });
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of metaTemplates) {
      const metaTemplateId = String(item?.id || "").trim();
      const metaTemplateName = String(item?.name || "").trim();

      if (!metaTemplateId && !metaTemplateName) {
        skippedCount += 1;
        continue;
      }

      const bodyText = extractMetaBodyText(item?.components);
      const headerComponent = extractMetaComponent(item?.components, "HEADER");
      const footerComponent = extractMetaComponent(item?.components, "FOOTER");
      const language = normalizeTemplateLanguage(item?.language);
      const metaStatus = String(item?.status || "").trim().toUpperCase();
      const metaCategory = String(item?.category || "").trim().toUpperCase();
      const headerFormat = String(headerComponent?.format || "").trim().toLowerCase();
      const headerType = ["text", "image", "video", "document"].includes(headerFormat) ? headerFormat : "none";
      const headerText = headerType === "text" ? String(headerComponent?.text || "").trim() : "";
      const footerText = String(footerComponent?.text || "").trim();
      const content = bodyText || metaTemplateName || "Meta template";
      const variables = Array.from(
        new Set([
          ...extractTemplateVariables(content),
          ...extractTemplateVariables(headerText)
        ])
      );
      const payload = {
        name: metaTemplateName || `meta_template_${metaTemplateId}`,
        language,
        category: metaCategory || "UTILITY",
        headerType,
        headerText,
        headerMediaHandle: "",
        footerText,
        content,
        variables,
        status: getLocalStatusFromMetaStatus(metaStatus),
        metaTemplateId,
        metaTemplateName,
        metaStatus,
        metaCategory,
        metaCreatedAt: parseMetaCreatedAt(item?.created_time),
        metaLastSyncAt: new Date(),
        metaError: ""
      };

      const existing = await Template.findOne({
        ownerId: req.user.id,
        ...(metaTemplateId
          ? { metaTemplateId }
          : { metaTemplateName })
      });

      if (existing) {
        Object.assign(existing, payload);
        await existing.save();
        updatedCount += 1;
      } else {
        await Template.create({
          ownerId: req.user.id,
          ...payload
        });
        createdCount += 1;
      }
    }

    return res.json({
      message: "meta templates imported",
      totalMetaTemplates: metaTemplates.length,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount
    });
  } catch (error) {
    return next(error);
  }
};

export const uploadTemplateMedia = async (req, res, next) => {
  try {
    const file = req.file;
    const mediaType = String(req.query?.mediaType || "").trim().toLowerCase();

    if (!file) {
      return res.status(400).json({ message: "media file is required" });
    }

    if (["image", "video", "document"].includes(mediaType)) {
      const mimeType = String(file.mimetype || "").toLowerCase();
      const isImage = mimeType.startsWith("image/");
      const isVideo = mimeType.startsWith("video/");

      if (mediaType === "image" && !isImage) {
        return res.status(400).json({ message: "selected header type is image, please upload an image file" });
      }

      if (mediaType === "video" && !isVideo) {
        return res.status(400).json({ message: "selected header type is video, please upload a video file" });
      }

      if (mediaType === "document" && (isImage || isVideo)) {
        return res.status(400).json({ message: "selected header type is document, please upload a document file" });
      }
    }

    const result = await uploadTemplateMediaToMeta({
      fileBuffer: file.buffer,
      fileName: file.originalname,
      fileType: file.mimetype || "application/octet-stream",
      fileLength: file.size,
      credentials: {
        whatsappToken: req.user?.whatsappToken,
        whatsappBusinessAccountId: req.user?.whatsappBusinessAccountId
      }
    });

    return res.json({
      message: "media uploaded",
      handle: result.handle,
      uploadSessionId: result.uploadSessionId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size
    });
  } catch (error) {
    return next(error);
  }
};
