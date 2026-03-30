import express from "express";
import {
  createUser,
  deleteUser,
  listUsers,
  updateMyProfile
} from "../controllers/user.controller.js";
import { requireAdmin, requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", requireAuth, requireAdmin, listUsers);
router.post("/", requireAuth, requireAdmin, createUser);
router.delete("/:id", requireAuth, requireAdmin, deleteUser);
router.put("/me", requireAuth, updateMyProfile);

export default router;
