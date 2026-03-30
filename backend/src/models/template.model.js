import mongoose from "mongoose";

const templateSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    language: {
      type: String,
      enum: ["tr", "en"],
      default: "tr"
    },
    category: {
      type: String,
      enum: ["MARKETING", "UTILITY", "AUTHENTICATION"],
      default: "UTILITY"
    },
    headerType: {
      type: String,
      enum: ["none", "text", "image", "video", "document"],
      default: "none"
    },
    headerText: {
      type: String,
      default: "",
      trim: true
    },
    headerMediaHandle: {
      type: String,
      default: "",
      trim: true
    },
    footerText: {
      type: String,
      default: "",
      trim: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    variables: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ["approved", "pending", "rejected"],
      default: "pending"
    },
    metaTemplateId: {
      type: String,
      default: ""
    },
    metaTemplateName: {
      type: String,
      default: ""
    },
    metaStatus: {
      type: String,
      default: ""
    },
    metaCategory: {
      type: String,
      default: ""
    },
    metaCreatedAt: {
      type: Date,
      default: null
    },
    metaLastSyncAt: {
      type: Date,
      default: null
    },
    metaError: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

const Template = mongoose.model("Template", templateSchema);

export default Template;
