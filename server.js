// -------------------- IMPORTS --------------------
import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import pkg from "pg";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();
const { Pool } = pkg;

// -------------------- PATH SETUP --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- APP SETUP --------------------
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// -------------------- DATABASE CONNECTION --------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

// Test DB connection
pool.connect()
  .then(() => console.log("✅ PostgreSQL Connected"))
  .catch(err => console.error("❌ DB Connection Error:", err.message));

// -------------------- GEMINI SETUP --------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// -------------------- MIDDLEWARE --------------------
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// -------------------- SIGNUP --------------------
app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword)
      return res.status(400).json({ error: "All fields required" });

    if (password !== confirmPassword)
      return res.status(400).json({ error: "Passwords do not match" });

    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0)
      return res.status(400).json({ error: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1,$2,$3)",
      [name, email, hashedPassword]
    );

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "2h" });

    res.json({ message: "Signup successful", token });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Signup failed" });
  }
});

// -------------------- LOGIN --------------------
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0)
      return res.status(400).json({ error: "User not found" });

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "2h" });

    res.json({
      message: "Login successful",
      token,
      user: {
        name: user.name,
        email: user.email,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
});

// -------------------- GENERATE QUIZ --------------------
app.post("/generate-quiz", async (req, res) => {
  try {
    const { subject, difficulty, limit } = req.body;

    if (!subject || !difficulty || !limit)
      return res.status(400).json({ error: "Missing fields" });

    if (!GEMINI_API_KEY)
      return res.status(500).json({ error: "Gemini key missing" });

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const prompt = `
Generate ${limit} ${difficulty} GATE MCQs on "${subject}".

Return ONLY JSON array.

Format:
[
  {
    "question": "Question text",
    "options": ["A", "B", "C", "D"],
    "answer": "Correct option text"
  }
]
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    const questions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    res.json(questions);

  } catch (error) {
    console.error("Gemini Error:", error.message);
    res.status(500).json({ error: "Quiz generation failed" });
  }
});

// -------------------- SAVE RESULT --------------------
app.post("/api/saveResult", async (req, res) => {
  try {
    const { name, subject, score, totalQuestions } = req.body;

    await pool.query(
      "INSERT INTO leaderboard (name, subject, score, totalquestions) VALUES ($1,$2,$3,$4)",
      [name, subject, score, totalQuestions]
    );

    res.json({ success: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Save failed" });
  }
});

// -------------------- LEADERBOARD --------------------
app.get("/api/leaderboard", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM leaderboard ORDER BY score DESC LIMIT 10"
    );

    res.json(result.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Fetch failed" });
  }
});

// -------------------- STATIC ROUTES --------------------
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.get("/:page", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", `${req.params.page}.html`),
    (err) => {
      if (err) res.status(404).send("Not found");
    }
  );
});

// -------------------- GLOBAL ERROR HANDLER --------------------
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
});

// -------------------- START SERVER --------------------
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
