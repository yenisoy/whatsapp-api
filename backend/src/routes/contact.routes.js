import express from "express";
import multer from "multer";
import {
  createContact,
  deleteContact,
  downloadImportTemplate,
  getContacts,
  importContacts
} from "../controllers/contact.controller.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post("/", createContact);
router.get("/", getContacts);
router.delete("/:id", deleteContact);
router.post("/import", upload.single("file"), importContacts);
router.get("/import/template", downloadImportTemplate);

export default router;