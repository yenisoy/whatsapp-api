import dotenv from "dotenv";
import mongoose from "mongoose";
import { Worker } from "bullmq";
import Contact from "../models/contact.model.js";
import Template from "../models/template.model.js";
import User from "../models/user.model.js";
import { getQueueConnection, SEND_BULK_QUEUE_NAME } from "../queues/send-bulk.queue.js";
import { sendWithTemplate } from "../services/message-send.service.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error("MONGO_URI is not defined");
}

await mongoose.connect(mongoUri);

const worker = new Worker(
  SEND_BULK_QUEUE_NAME,
  async (job) => {
    const { userId, ownerId, contactId, templateId, variables = {}, mediaUrl = "" } = job.data;
    const scopedOwnerId = ownerId || userId;

    const [user, contact, template] = await Promise.all([
      User.findById(userId),
      Contact.findOne({ _id: contactId, ownerId: scopedOwnerId }),
      Template.findOne({ _id: templateId, ownerId: scopedOwnerId })
    ]);

    if (!user) {
      throw new Error(`user not found: ${userId}`);
    }

    if (!contact) {
      throw new Error(`contact not found: ${contactId}`);
    }

    if (!template) {
      throw new Error(`template not found: ${templateId}`);
    }

    const mergedVariables = {
      name: contact.name || "",
      ...variables
    };

    const result = await sendWithTemplate({
      ownerId: scopedOwnerId,
      phone: contact.phone,
      contactId: contact._id,
      template,
      variables: mergedVariables,
      mediaUrl,
      credentials: {
        whatsappToken: user.whatsappToken || "",
        whatsappPhoneId: user.whatsappPhoneId || ""
      }
    });

    if (!result.success) {
      throw new Error(result.log?.error || "send failed");
    }

    return {
      messageId: String(result.log._id),
      status: result.log.status
    };
  },
  {
    connection: getQueueConnection(),
    concurrency: 5
  }
);

worker.on("ready", () => {
  console.log("Bulk worker ready");
});

worker.on("completed", (job) => {
  console.log(`Bulk job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Bulk job failed: ${job?.id || "unknown"} - ${error.message}`);
});
