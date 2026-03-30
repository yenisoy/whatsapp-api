import express from "express";
import multer from "multer";
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  importTemplatesFromMeta,
  publishTemplate,
  previewTemplateVariables,
  syncTemplateMetaStatus,
  uploadTemplateMedia
} from "../controllers/template.controller.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

router.post("/", createTemplate);
router.get("/", getTemplates);
router.post("/import-meta", importTemplatesFromMeta);
router.post("/media/upload", upload.single("file"), uploadTemplateMedia);
router.delete("/:id", deleteTemplate);
router.post("/preview/variables", previewTemplateVariables);
router.post("/:id/publish-meta", publishTemplate);
router.post("/:id/sync-meta", syncTemplateMetaStatus);

export default router;
