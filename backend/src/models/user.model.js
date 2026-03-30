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
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

const User = mongoose.model("User", userSchema);

export default User;
