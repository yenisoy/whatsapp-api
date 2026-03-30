import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    name: {
      type: String,
      trim: true,
      default: ""
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    tag: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

contactSchema.index({ tag: 1 });
contactSchema.index({ ownerId: 1, phone: 1 }, { unique: true });

const Contact = mongoose.model("Contact", contactSchema);

export default Contact;
