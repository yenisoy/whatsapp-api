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
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
      index: true
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      default: null
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      default: null
    },
    direction: {
      type: String,
      enum: ["inbound", "outbound"],
      default: "outbound",
      index: true
    },
    messageType: {
      type: String,
      default: "template"
    },
    body: {
      type: String,
      default: ""
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
messageSchema.index({ ownerId: 1, conversationId: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
