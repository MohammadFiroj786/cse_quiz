const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0"; // Important for Render

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, "public")));

// API Route
app.post("/generate-quiz", async (req, res) => {
    const { subject, examType } = req.body;

    const prompt = `Generate exactly 5 multiple choice questions for a ${examType.toUpperCase()} exam in ${subject.toUpperCase()}.
Return ONLY valid JSON in this format:
[
  {
    "question": "What is ...?",
    "options": ["A", "B", "C", "D"],
    "answer": "A"
  }
]`;

    try {
        const pplxResponse = await axios.post(
            "https://api.perplexity.ai/chat/completions",
            {
                model: "sonar-pro",
                messages: [
                    { role: "system", content: "You are a quiz generator. Only return valid JSON." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const content = pplxResponse.data.choices[0].message.content.trim();

        let questions;
        try {
            questions = JSON.parse(content);
            if (!Array.isArray(questions)) throw new Error("Response is not an array");
        } catch (err) {
            console.error("Parsing error:", err.message, "Content:", content);
            return res.status(500).json({ error: "Invalid Perplexity response format" });
        }

        res.json(questions);

    } catch (err) {
        console.error("Perplexity API Error:", err.response?.data || err.message);
        res.status(500).json({ error: "Failed to generate quiz from Perplexity" });
    }
});

// Serve index.html at root
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Serve other HTML files if accessed directly
app.get("/:page", (req, res) => {
    const page = req.params.page;
    res.sendFile(path.join(__dirname, "public", `${page}.html`));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Unexpected server error:", err);
    res.status(500).send("Internal Server Error");
});

// Start server
const server = app.listen(PORT, HOST, () => {
    console.log(`✅ Server running at http://${HOST}:${PORT}`);
});
