import { parse } from "csv-parse/sync";
import xlsx from "xlsx";
import Contact from "../models/contact.model.js";

const allowedHeaders = ["name", "phone", "tag"];

const normalizePhone = (phone) => String(phone || "").replaceAll(/\D/g, "").trim();

const buildContactFilter = ({ ownerId, tag = "", tags = "", q = "" }) => {
  const filter = { ownerId };

  const normalizedSingleTag = String(tag || "").trim();
  const normalizedTags = String(tags || "")
    .split(",")
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (normalizedTags.length > 0) {
    filter.tag = { $in: normalizedTags };
  } else if (normalizedSingleTag) {
    filter.tag = normalizedSingleTag;
  }

  const normalizedQuery = String(q || "").trim();

  if (normalizedQuery) {
    filter.$or = [
      { name: { $regex: normalizedQuery, $options: "i" } },
      { phone: { $regex: normalizedQuery, $options: "i" } },
      { tag: { $regex: normalizedQuery, $options: "i" } }
    ];
  }

  return filter;
};

const escapeCsvValue = (value) => {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
};

const mapToContact = (row) => {
  const name = String(row.name || "").trim();
  const phone = normalizePhone(row.phone);
  const tag = String(row.tag || "").trim();

  return { name, phone, tag };
};

const validateContacts = (rows) => {
  const contacts = [];

  rows.forEach((row, index) => {
    const contact = mapToContact(row);

    if (!contact.phone) {
      throw new Error(`Row ${index + 2}: phone is required`);
    }

    contacts.push(contact);
  });

  return contacts;
};

const parseCsvBuffer = (buffer) => {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records;
};

const parseExcelBuffer = (buffer) => {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    return [];
  }

  return xlsx.utils.sheet_to_json(workbook.Sheets[firstSheet], {
    defval: ""
  });
};

const normalizeHeaderKeys = (row) => {
  const normalized = {};

  Object.keys(row).forEach((key) => {
    const normalizedKey = String(key).trim().toLowerCase();
    if (allowedHeaders.includes(normalizedKey)) {
      normalized[normalizedKey] = row[key];
    }
  });

  return normalized;
};

export const createContact = async (req, res, next) => {
  try {
    const contact = mapToContact(req.body);

    if (!contact.phone) {
      return res.status(400).json({ message: "phone is required" });
    }

    const created = await Contact.create({
      ...contact,
      ownerId: req.user.id
    });
    return res.status(201).json(created);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "phone already exists" });
    }
    return next(error);
  }
};

export const getContacts = async (req, res, next) => {
  try {
    const filter = buildContactFilter({
      ownerId: req.user.id,
      tag: req.query?.tag,
      tags: req.query?.tags,
      q: req.query?.q
    });

    const contacts = await Contact.find(filter).sort({ createdAt: -1 });
    return res.json(contacts);
  } catch (error) {
    return next(error);
  }
};

export const deleteContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await Contact.findOneAndDelete({
      _id: id,
      ownerId: req.user.id
    });

    if (!deleted) {
      return res.status(404).json({ message: "contact not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

export const importContacts = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "file is required" });
    }

    const fileName = (req.file.originalname || "").toLowerCase();
    const isCsv = fileName.endsWith(".csv");
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    if (!isCsv && !isExcel) {
      return res.status(400).json({
        message: "only .csv, .xlsx or .xls files are supported"
      });
    }

    const rawRows = isCsv
      ? parseCsvBuffer(req.file.buffer)
      : parseExcelBuffer(req.file.buffer);

    const normalizedRows = rawRows.map(normalizeHeaderKeys);
    const contacts = validateContacts(normalizedRows);

    if (!contacts.length) {
      return res.status(400).json({ message: "file has no valid rows" });
    }

    const upsertOps = contacts.map((contact) => ({
      updateOne: {
        filter: { ownerId: req.user.id, phone: contact.phone },
        update: {
          $set: {
            ...contact,
            ownerId: req.user.id
          }
        },
        upsert: true
      }
    }));

    const result = await Contact.bulkWrite(upsertOps, { ordered: false });

    return res.status(200).json({
      imported: contacts.length,
      upserted: result.upsertedCount || 0,
      updated: result.modifiedCount || 0
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const downloadImportTemplate = async (req, res, next) => {
  try {
    const format = String(req.query.format || "csv").toLowerCase();
    const rows = [{ name: "Ahmet", phone: "905551112233", tag: "lead" }];

    if (format === "xlsx" || format === "xls") {
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.json_to_sheet(rows, {
        header: allowedHeaders
      });
      xlsx.utils.book_append_sheet(workbook, worksheet, "contacts");

      const buffer = xlsx.write(workbook, {
        type: "buffer",
        bookType: "xlsx"
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=contact-import-template.xlsx"
      );

      return res.status(200).send(buffer);
    }

    const csvHeader = `${allowedHeaders.join(",")}\n`;
    const csvBody = rows.map((row) => `${row.name},${row.phone},${row.tag}`).join("\n");
    const csvContent = `${csvHeader}${csvBody}\n`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=contact-import-template.csv"
    );

    return res.status(200).send(csvContent);
  } catch (error) {
    return next(error);
  }
};

export const exportContacts = async (req, res, next) => {
  try {
    const format = String(req.query.format || "csv").toLowerCase();
    const filter = buildContactFilter({
      ownerId: req.user.id,
      tag: req.query?.tag,
      tags: req.query?.tags,
      q: req.query?.q
    });

    const contacts = await Contact.find(filter).sort({ createdAt: -1 }).lean();
    const rows = contacts.map((contact) => ({
      name: String(contact.name || "").trim(),
      phone: String(contact.phone || "").trim(),
      tag: String(contact.tag || "").trim()
    }));

    if (format === "xlsx" || format === "xls") {
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.json_to_sheet(rows, {
        header: allowedHeaders
      });
      xlsx.utils.book_append_sheet(workbook, worksheet, "contacts");

      const buffer = xlsx.write(workbook, {
        type: "buffer",
        bookType: "xlsx"
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=contacts-export.xlsx"
      );

      return res.status(200).send(buffer);
    }

    const csvHeader = `${allowedHeaders.join(",")}\n`;
    const csvBody = rows
      .map((row) => [row.name, row.phone, row.tag].map(escapeCsvValue).join(","))
      .join("\n");
    const csvContent = `${csvHeader}${csvBody}${rows.length ? "\n" : ""}`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=contacts-export.csv"
    );

    return res.status(200).send(csvContent);
  } catch (error) {
    return next(error);
  }
};