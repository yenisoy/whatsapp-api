import express from "express";
import { login, me } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", requireAuth, me);

export default router;
