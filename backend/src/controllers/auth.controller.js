import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const getJwtSecret = () => process.env.JWT_SECRET || "dev-secret-change-me";

const buildToken = (user) => {
  return jwt.sign(
    {
      role: user.role,
      username: user.username
    },
    getJwtSecret(),
    {
      subject: String(user._id),
      expiresIn: "7d"
    }
  );
};

const serializeUser = (user) => ({
  id: String(user._id),
  username: user.username,
  role: user.role,
  whatsappToken: user.whatsappToken || "",
  whatsappPhoneId: user.whatsappPhoneId || "",
  whatsappBusinessAccountId: user.whatsappBusinessAccountId || ""
});

export const login = async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return res.status(400).json({ message: "username and password are required" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "invalid credentials" });
    }

    const token = buildToken(user);

    return res.json({
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    return next(error);
  }
};

export const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    return res.json({ user: serializeUser(user) });
  } catch (error) {
    return next(error);
  }
};
