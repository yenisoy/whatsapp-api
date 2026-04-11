import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { removeUserMediaFiles, saveUserMediaBuffer } from "../utils/user-media-storage.js";

const fetchRemoteMedia = async (sourceUrl) => {
  const url = String(sourceUrl || "").trim();
  if (!url) {
    throw new Error("sourceUrl is required");
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("sourceUrl must be a valid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("sourceUrl must use http or https");
  }

  const response = await fetch(parsed.toString());
  if (!response.ok) {
    throw new Error(`media download failed with ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = String(response.headers.get("content-type") || "application/octet-stream").split(";")[0].trim().toLowerCase();

  return {
    buffer,
    mimeType: contentType,
    fileName: parsed.pathname.split("/").pop() || "remote-media",
    sourceUrl: parsed.toString()
  };
};

const sanitizeUser = (user) => ({
  id: String(user._id),
  username: user.username,
  role: user.role,
  whatsappToken: user.whatsappToken || "",
  whatsappPhoneId: user.whatsappPhoneId || "",
  whatsappBusinessAccountId: user.whatsappBusinessAccountId || "",
  mediaFileName: user.mediaFileName || "",
  mediaOriginalName: user.mediaOriginalName || "",
  mediaMimeType: user.mediaMimeType || "",
  mediaUrl: user.mediaUrl || "",
  mediaSourceUrl: user.mediaSourceUrl || "",
  mediaUpdatedAt: user.mediaUpdatedAt || null,
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

export const getMyMedia = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    return res.json({
      mediaFileName: user.mediaFileName || "",
      mediaOriginalName: user.mediaOriginalName || "",
      mediaMimeType: user.mediaMimeType || "",
      mediaUrl: user.mediaUrl || "",
      mediaSourceUrl: user.mediaSourceUrl || "",
      mediaUpdatedAt: user.mediaUpdatedAt || null
    });
  } catch (error) {
    return next(error);
  }
};

export const uploadMyMedia = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    const file = req.file;
    const sourceUrl = String(req.body?.sourceUrl || "").trim();

    let buffer = null;
    let mimeType = "application/octet-stream";
    let originalName = "media-file";
    let resolvedSourceUrl = sourceUrl;

    if (file) {
      buffer = file.buffer;
      mimeType = file.mimetype || mimeType;
      originalName = file.originalname || originalName;
    } else if (sourceUrl) {
      const remote = await fetchRemoteMedia(sourceUrl);
      buffer = remote.buffer;
      mimeType = remote.mimeType || mimeType;
      originalName = remote.fileName || originalName;
      resolvedSourceUrl = remote.sourceUrl;
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ message: "file or sourceUrl is required" });
    }

    const previousFileName = user.mediaFileName || "";
    const media = await saveUserMediaBuffer({
      userId: user._id,
      buffer,
      mimeType,
      originalName,
      sourceUrl: resolvedSourceUrl
    });

    user.mediaFileName = media.mediaFileName;
    user.mediaOriginalName = media.mediaOriginalName;
    user.mediaMimeType = media.mediaMimeType;
    user.mediaUrl = media.mediaUrl;
    user.mediaSourceUrl = media.mediaSourceUrl;
    user.mediaUpdatedAt = media.mediaUpdatedAt;
    await user.save();

    if (previousFileName && previousFileName !== media.mediaFileName) {
      await removeUserMediaFiles(user._id);
      const refreshed = await saveUserMediaBuffer({
        userId: user._id,
        buffer,
        mimeType,
        originalName,
        sourceUrl: resolvedSourceUrl
      });

      user.mediaFileName = refreshed.mediaFileName;
      user.mediaOriginalName = refreshed.mediaOriginalName;
      user.mediaMimeType = refreshed.mediaMimeType;
      user.mediaUrl = refreshed.mediaUrl;
      user.mediaSourceUrl = refreshed.mediaSourceUrl;
      user.mediaUpdatedAt = refreshed.mediaUpdatedAt;
      await user.save();
    }

    return res.json({
      message: "media updated",
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteMyMedia = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    await removeUserMediaFiles(user._id);

    user.mediaFileName = "";
    user.mediaOriginalName = "";
    user.mediaMimeType = "";
    user.mediaUrl = "";
    user.mediaSourceUrl = "";
    user.mediaUpdatedAt = null;
    await user.save();

    return res.json({
      message: "media deleted",
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
};
