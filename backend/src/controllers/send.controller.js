import Contact from "../models/contact.model.js";
import Template from "../models/template.model.js";
import { enqueueBulkSendJob } from "../queues/send-bulk.queue.js";
import { sendWithTemplate } from "../services/message-send.service.js";

export const sendSingleMessage = async (req, res, next) => {
  try {
    const { phone, templateId, variables = {}, mediaUrl = "" } = req.body;

    if (!phone || !templateId) {
      return res.status(400).json({ message: "phone and templateId are required" });
    }

    const template = await Template.findOne({ _id: templateId, ownerId: req.user.id });
    if (!template) {
      return res.status(404).json({ message: "template not found" });
    }

    const isMediaTemplate = ["image", "video", "document"].includes(String(template.headerType || "").toLowerCase());
    if (isMediaTemplate && !String(mediaUrl || "").trim()) {
      return res.status(400).json({ message: "mediaUrl is required for media header templates" });
    }

    const result = await sendWithTemplate({
      ownerId: req.user.id,
      phone,
      template,
      variables,
      mediaUrl,
      credentials: {
        whatsappToken: req.user?.whatsappToken,
        whatsappPhoneId: req.user?.whatsappPhoneId
      }
    });

    return res.status(200).json({
      success: result.success,
      mode: result.mode,
      messageId: result.log._id,
      providerMessageId: result.log.providerMessageId,
      mediaUrl: result.log.mediaUrl || "",
      status: result.log.status,
      providerStatus: result.providerStatus || "",
      error: result.log.error
    });
  } catch (error) {
    return next(error);
  }
};

export const sendBulkMessage = async (req, res, next) => {
  try {
    const { contactIds = [], templateId, variables = {}, mediaUrl = "" } = req.body;

    if (!Array.isArray(contactIds) || contactIds.length === 0 || !templateId) {
      return res.status(400).json({ message: "contactIds and templateId are required" });
    }

    const template = await Template.findOne({ _id: templateId, ownerId: req.user.id });
    if (!template) {
      return res.status(404).json({ message: "template not found" });
    }

    const isMediaTemplate = ["image", "video", "document"].includes(String(template.headerType || "").toLowerCase());
    if (isMediaTemplate && !String(mediaUrl || "").trim()) {
      return res.status(400).json({ message: "mediaUrl is required for media header templates" });
    }

    const contacts = await Contact.find({ ownerId: req.user.id, _id: { $in: contactIds } });
    if (!contacts.length) {
      return res.status(404).json({ message: "contacts not found" });
    }

    const jobs = [];

    for (const contact of contacts) {
      const job = await enqueueBulkSendJob({
        userId: req.user.id,
        ownerId: req.user.id,
        contactId: contact._id,
        templateId: template._id,
        variables,
        mediaUrl
      });

      jobs.push({
        jobId: job.id,
        contactId: contact._id,
        phone: contact.phone,
        status: "queued"
      });
    }

    return res.status(202).json({
      total: contacts.length,
      queued: jobs.length,
      results: jobs
    });
  } catch (error) {
    return next(error);
  }
};