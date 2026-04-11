import fs from "fs/promises";
import path from "path";

const MEDIA_ROOT = path.join(process.cwd(), "uploads", "user-media");

const MIME_EXTENSION_MAP = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/x-msvideo": ".avi",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "application/zip": ".zip"
};

const buildUserDir = (userId) => path.join(MEDIA_ROOT, String(userId));

const ensureUserDir = async (userId) => {
  const dir = buildUserDir(userId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

export const buildUserMediaUrl = (userId, fileName) => {
  if (!fileName) {
    return "";
  }

  return `/uploads/user-media/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(fileName))}`;
};

export const inferMediaExtension = ({ mimeType = "", originalName = "" } = {}) => {
  const normalizedMime = String(mimeType || "").trim().toLowerCase();
  if (MIME_EXTENSION_MAP[normalizedMime]) {
    return MIME_EXTENSION_MAP[normalizedMime];
  }

  const existingExt = path.extname(String(originalName || "")).trim().toLowerCase();
  if (existingExt) {
    return existingExt;
  }

  return ".bin";
};

export const removeUserMediaFiles = async (userId) => {
  const dir = buildUserDir(userId);
  await fs.rm(dir, { recursive: true, force: true });
};

export const saveUserMediaBuffer = async ({ userId, buffer, mimeType, originalName, sourceUrl = "" }) => {
  const dir = await ensureUserDir(userId);
  const extension = inferMediaExtension({ mimeType, originalName });
  const fileName = `current${extension}`;
  const filePath = path.join(dir, fileName);

  await fs.writeFile(filePath, buffer);

  return {
    mediaFileName: fileName,
    mediaOriginalName: String(originalName || fileName),
    mediaMimeType: String(mimeType || "application/octet-stream"),
    mediaSourceUrl: String(sourceUrl || "").trim(),
    mediaUrl: buildUserMediaUrl(userId, fileName),
    mediaUpdatedAt: new Date()
  };
};