import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      default: null
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      required: true
    },
    variables: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    status: {
      type: String,
      enum: ["queued", "sent", "delivered", "read", "failed"],
      default: "queued"
    },
    error: {
      type: String,
      default: ""
    },
    providerMessageId: {
      type: String,
      default: ""
    },
    providerRequestUrl: {
      type: String,
      default: ""
    },
    providerRequestBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    mediaUrl: {
      type: String,
      default: ""
    },
    providerStatus: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

messageSchema.index({ phone: 1 });
messageSchema.index({ providerMessageId: 1 });
messageSchema.index({ createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
