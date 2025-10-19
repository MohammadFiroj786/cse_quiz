// server.js
import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || "";

// -------------------- Middleware --------------------
app.use(express.json());

// CORS for localhost + deployed frontend
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5500";
app.use(
  cors({
    origin: [FRONTEND_URL],
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// -------------------- MongoDB Connection --------------------
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err.message));

// -------------------- Schemas --------------------
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, sparse: true },
  password: String,
  photoURL: String,
  createdAt: { type: Date, default: Date.now },
  googleId: String,
});

const leaderboardSchema = new mongoose.Schema({
  name: String,
  subject: String,
  score: Number,
  totalQuestions: Number,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Leaderboard = mongoose.models.Leaderboard || mongoose.model("Leaderboard", leaderboardSchema, "leaderboard");

// -------------------- Signup --------------------
app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    if (!name || !email || !password || !confirmPassword)
      return res.status(400).json({ error: "All fields are required" });
    if (password !== confirmPassword)
      return res.status(400).json({ error: "Passwords do not match" });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    const token = jwt.sign({ email: newUser.email }, JWT_SECRET, { expiresIn: "2h" });
    res.json({ message: "Signup successful", token, user: { name: newUser.name, email: newUser.email } });
  } catch (error) {
    console.error("Signup Error:", error.message);
    res.status(500).json({ error: "Server error during signup" });
  }
});

// -------------------- Login --------------------
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: "2h" });
    res.json({ message: "Login successful", token, user: { name: user.name, email: user.email, photoURL: user.photoURL || null } });
  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ error: "Server error during login" });
  }
});

// -------------------- Quiz Generation --------------------
app.post("/generate-quiz", async (req, res) => {
  try {
    const { subject, difficulty, limit } = req.body;
    if (!subject || !difficulty || !limit) return res.status(400).json({ error: "Missing required fields" });

    if (!PERPLEXITY_API_KEY) {
      console.warn("⚠️ Using fallback questions (no API key)");
      return res.json(generateFallbackQuestions(subject, difficulty, limit));
    }

    const prompt = `
Generate ${limit} ${difficulty}-level GATE MCQs on "${subject}".
Return ONLY JSON array like:
[{"question": "...", "options": ["A","B","C","D"], "answer": "A"}]
`;

    const response = await axios.post(
      "https://api.perplexity.ai/chat/completions",
      { model: "sonar", messages: [{ role: "user", content: prompt }] },
      { headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" } }
    );

    const text = response.data?.choices?.[0]?.message?.content || "";
    const cleaned = text.replace(/```(?:json)?/gi, "").replace(/`/g, "").trim();
    const questions = JSON.parse(cleaned);
    res.json(questions);
  } catch (error) {
    console.error("❌ Quiz Error:", error.message);
    res.json(generateFallbackQuestions(req.body.subject, req.body.difficulty, req.body.limit));
  }
});

function generateFallbackQuestions(subject, difficulty, limit) {
  const sample = [
    { question: `Which data structure is LIFO? (${subject})`, options: ["Stack", "Queue", "Tree", "Heap"], answer: "Stack" },
    { question: `Which sort uses divide & conquer? (${subject})`, options: ["Merge Sort", "Bubble Sort", "Quick Sort", "Insertion Sort"], answer: "Merge Sort" },
  ];
  return Array.from({ length: limit }, (_, i) => sample[i % sample.length]);
}

// -------------------- Leaderboard --------------------
app.post("/api/saveResult", async (req, res) => {
  try {
    const { name, subject, score, totalQuestions } = req.body;
    if (!name || !subject) return res.status(400).json({ error: "Missing fields" });

    const entry = new Leaderboard({ name, subject, score, totalQuestions });
    await entry.save();
    res.json({ success: true, message: "Result stored" });
  } catch (err) {
    console.error("❌ Save Result Error:", err.message);
    res.status(500).json({ error: "Server error saving result" });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const results = await Leaderboard.find().sort({ score: -1 }).limit(10);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// -------------------- Routes --------------------
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/:page", (req, res) => {
  res.sendFile(path.join(__dirname, "public", `${req.params.page}.html`), (err) => {
    if (err) res.status(404).send("Not found");
  });
});

// -------------------- Start Server --------------------
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
