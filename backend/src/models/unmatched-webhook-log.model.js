import mongoose from "mongoose";

const unmatchedWebhookLogSchema = new mongoose.Schema(
  {
    webhookPath: {
      type: String,
      default: "",
      index: true
    },
    phoneNumberIds: {
      type: [String],
      default: []
    },
    reason: {
      type: String,
      default: "owner_not_found"
    },
    sourceUrl: {
      type: String,
      default: ""
    },
    requestMethod: {
      type: String,
      default: "POST"
    },
    requestBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

unmatchedWebhookLogSchema.index({ createdAt: -1 });

const UnmatchedWebhookLog = mongoose.model("UnmatchedWebhookLog", unmatchedWebhookLogSchema);

export default UnmatchedWebhookLog;