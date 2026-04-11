import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
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
    contactName: {
      type: String,
      default: "",
      trim: true
    },
    lastMessageText: {
      type: String,
      default: ""
    },
    lastMessageType: {
      type: String,
      default: "text"
    },
    lastDirection: {
      type: String,
      enum: ["inbound", "outbound"],
      default: "outbound"
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    unreadCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

conversationSchema.index({ ownerId: 1, phone: 1 }, { unique: true });
conversationSchema.index({ ownerId: 1, lastMessageAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
