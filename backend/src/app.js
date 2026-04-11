import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import logsRoutes from "./routes/logs.routes.js";
import sendRoutes from "./routes/send.routes.js";
import templateRoutes from "./routes/template.routes.js";
import userRoutes from "./routes/user.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import { requireAuth } from "./middlewares/auth.middleware.js";
import { runDataMigrations } from "./utils/run-migrations.js";
import { ensureAdminUser } from "./utils/seed-admin.js";

dotenv.config();

const app = express();
const uploadsPath = path.join(process.cwd(), "uploads");

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsPath));
app.use("/webhooks", webhookRoutes);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/contacts", requireAuth, contactRoutes);
app.use("/templates", requireAuth, templateRoutes);
app.use("/send", requireAuth, sendRoutes);
app.use("/logs", requireAuth, logsRoutes);

app.get("/", (req, res) => {
  res.json({ message: "WhatsApp API backend is running" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: error.message || "Internal Server Error"
  });
});

const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGO_URI;

const start = async () => {
  try {
    if (!mongoUri) {
      throw new Error("MONGO_URI is not defined");
    }

    await mongoose.connect(mongoUri);
    await runDataMigrations();
    await ensureAdminUser();
    app.listen(port, () => {
      console.log(`Backend running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start backend:", error.message);
    process.exit(1);
  }
};

start();
