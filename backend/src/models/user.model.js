import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 64
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user"
    },
    whatsappToken: {
      type: String,
      default: ""
    },
    whatsappPhoneId: {
      type: String,
      default: ""
    },
    whatsappBusinessAccountId: {
      type: String,
      default: ""
    },
    mediaFileName: {
      type: String,
      default: ""
    },
    mediaOriginalName: {
      type: String,
      default: ""
    },
    mediaMimeType: {
      type: String,
      default: ""
    },
    mediaUrl: {
      type: String,
      default: ""
    },
    mediaSourceUrl: {
      type: String,
      default: ""
    },
    mediaUpdatedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

const User = mongoose.model("User", userSchema);

export default User;
