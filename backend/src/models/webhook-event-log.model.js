import mongoose from "mongoose";

const webhookEventLogSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    category: {
      type: String,
      enum: ["verification", "incoming", "relay", "processing"],
      default: "incoming",
      index: true
    },
    level: {
      type: String,
      enum: ["info", "success", "warning", "error"],
      default: "info",
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      default: ""
    },
    sourceUrl: {
      type: String,
      default: ""
    },
    targetUrl: {
      type: String,
      default: ""
    },
    requestMethod: {
      type: String,
      default: ""
    },
    responseStatus: {
      type: Number,
      default: null
    },
    requestBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    responseBody: {
      type: String,
      default: ""
    },
    relatedProviderMessageId: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

webhookEventLogSchema.index({ ownerId: 1, createdAt: -1 });
webhookEventLogSchema.index({ category: 1, createdAt: -1 });

const WebhookEventLog = mongoose.model("WebhookEventLog", webhookEventLogSchema);

export default WebhookEventLog;