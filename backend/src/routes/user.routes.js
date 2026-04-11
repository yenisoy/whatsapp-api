import express from "express";
import multer from "multer";
import {
  createUser,
  deleteUser,
  deleteMyMedia,
  getMyMedia,
  listUsers,
  regenerateMyWebhookToken,
  uploadMyMedia,
  updateMyProfile
} from "../controllers/user.controller.js";
import { requireAdmin, requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

router.get("/", requireAuth, requireAdmin, listUsers);
router.post("/", requireAuth, requireAdmin, createUser);
router.delete("/:id", requireAuth, requireAdmin, deleteUser);
router.put("/me", requireAuth, updateMyProfile);
router.post("/me/webhook-token/regenerate", requireAuth, regenerateMyWebhookToken);
router.get("/me/media", requireAuth, getMyMedia);
router.post("/me/media", requireAuth, upload.single("file"), uploadMyMedia);
router.delete("/me/media", requireAuth, deleteMyMedia);

export default router;
