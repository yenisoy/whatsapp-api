import fs from "node:fs/promises";
import path from "node:path";

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

const getPublicBaseUrl = () => {
  const configured = String(
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_PUBLIC_BASE_URL ||
    process.env.VITE_API_BASE_URL ||
    ""
  ).trim();

  if (!configured) {
    return "";
  }

  if (/^https?:\/\//i.test(configured)) {
    return configured.replace(/\/$/, "");
  }

  return `http://${configured.replace(/^\/+/, "")}`.replace(/\/$/, "");
};

export const resolvePublicMediaUrl = (mediaUrl = "") => {
  const value = String(mediaUrl || "").trim();

  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const baseUrl = getPublicBaseUrl();
  if (!baseUrl) {
    return value;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
};

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
    mediaUrl: resolvePublicMediaUrl(buildUserMediaUrl(userId, fileName)),
    mediaUpdatedAt: new Date()
  };
};