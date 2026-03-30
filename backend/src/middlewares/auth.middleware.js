import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const getJwtSecret = () => process.env.JWT_SECRET || "dev-secret-change-me";

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = String(req.headers.authorization || "");

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "unauthorized" });
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, getJwtSecret());

    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: "unauthorized" });
    }

    req.user = {
      id: String(user._id),
      username: user.username,
      role: user.role,
      whatsappToken: user.whatsappToken || "",
      whatsappPhoneId: user.whatsappPhoneId || "",
      whatsappBusinessAccountId: user.whatsappBusinessAccountId || ""
    };

    return next();
  } catch {
    return res.status(401).json({ message: "unauthorized" });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "forbidden" });
  }

  return next();
};
