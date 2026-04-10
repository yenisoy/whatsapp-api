export const normalizeLanguageCode = (language = "") => {
  const raw = String(language || "").trim();

  if (!raw) {
    return "tr";
  }

  const normalized = raw.replaceAll("-", "_");
  const parts = normalized.split("_").filter(Boolean);

  if (parts.length === 1) {
    const lower = parts[0].toLowerCase();

    if (lower === "en") {
      return "en_US";
    }

    return lower;
  }

  const [languagePart, regionPart] = parts;
  return `${String(languagePart || "").toLowerCase()}_${String(regionPart || "").toUpperCase()}`;
};