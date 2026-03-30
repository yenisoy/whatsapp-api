import bcrypt from "bcryptjs";
import User from "../models/user.model.js";

export const ensureAdminUser = async () => {
  const adminUsername = String(process.env.ADMIN_USERNAME || "admin").trim();
  const adminPassword = String(process.env.ADMIN_PASSWORD || "admin123").trim();

  const existing = await User.findOne({ username: adminUsername });
  if (existing) {
    return existing;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  return User.create({
    username: adminUsername,
    passwordHash,
    role: "admin",
    whatsappToken: process.env.WHATSAPP_TOKEN || "",
    whatsappPhoneId: process.env.WHATSAPP_PHONE_ID || "",
    whatsappBusinessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || ""
  });
};
