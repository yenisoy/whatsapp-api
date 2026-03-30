import bcrypt from "bcryptjs";
import User from "../models/user.model.js";

const sanitizeUser = (user) => ({
  id: String(user._id),
  username: user.username,
  role: user.role,
  whatsappToken: user.whatsappToken || "",
  whatsappPhoneId: user.whatsappPhoneId || "",
  whatsappBusinessAccountId: user.whatsappBusinessAccountId || "",
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

export const listUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    return res.json(users.map(sanitizeUser));
  } catch (error) {
    return next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "user").trim().toLowerCase();

    if (!username || !password) {
      return res.status(400).json({ message: "username and password are required" });
    }

    if (!["admin", "user"].includes(role)) {
      return res.status(400).json({ message: "role must be admin or user" });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ message: "username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await User.create({
      username,
      passwordHash,
      role
    });

    return res.status(201).json(sanitizeUser(created));
  } catch (error) {
    return next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (String(id) === String(req.user.id)) {
      return res.status(400).json({ message: "admin cannot delete itself" });
    }

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "user not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

export const updateMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    const whatsappToken = String(req.body?.whatsappToken || "").trim();
    const whatsappPhoneId = String(req.body?.whatsappPhoneId || "").trim();
    const whatsappBusinessAccountId = String(req.body?.whatsappBusinessAccountId || "").trim();
    const password = String(req.body?.password || "");

    user.whatsappToken = whatsappToken;
    user.whatsappPhoneId = whatsappPhoneId;
    user.whatsappBusinessAccountId = whatsappBusinessAccountId;

    if (password) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }

    await user.save();

    return res.json({
      message: "profile updated",
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
};
