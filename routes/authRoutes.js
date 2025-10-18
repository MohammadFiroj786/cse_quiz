// routes/authRoutes.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";

dotenv.config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ===== Signup (email/password) =====
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Missing fields" });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ message: "Signup successful", token, user: { name: user.name, email: user.email, avatar: user.avatar } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== Login (email/password) =====
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Missing fields" });

    const user = await User.findOne({ email });
    if (!user || !user.password) return res.status(400).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Login successful", token, user: { name: user.name, email: user.email, avatar: user.avatar } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== Google Sign-In (frontend sends id_token) =====
router.post("/google", async (req, res) => {
  try {
    const { id_token } = req.body;
    if (!id_token) return res.status(400).json({ message: "Missing id_token" });

    // Verify token with Google
    const ticket = await googleClient.verifyIdToken({ idToken: id_token, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ name: name || email.split("@")[0], email, avatar: picture, password: "" });
    } else {
      // update avatar/name if missing
      const modified = {};
      if (!user.avatar && picture) modified.avatar = picture;
      if (!user.name && name) modified.name = name;
      if (Object.keys(modified).length) await User.updateOne({ _id: user._id }, { $set: modified });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Google login success", token, user: { name: user.name, email: user.email, avatar: user.avatar } });
  } catch (err) {
    console.error("Google auth error", err);
    res.status(401).json({ message: "Invalid Google token" });
  }
});

export default router;
