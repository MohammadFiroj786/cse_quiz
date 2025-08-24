require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");

const app = express();
const port = process.env.PORT || 5000; // Render provides PORT

// ------------------- Middleware -------------------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "build"))); // Serve React frontend

// ------------------- API Route -------------------
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
            console.error("Parsing error:", err.message);
            return res.status(500).json({ error: "Invalid Perplexity response format" });
        }

        res.json(questions);

    } catch (err) {
        console.error("Perplexity API Error:", err.response?.data || err.message);
        res.status(500).json({ error: "Failed to generate quiz from Perplexity" });
    }
});

// ------------------- Catch-all route for SPA -------------------
app.get("/*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
});

// ------------------- Global Error Handler -------------------
app.use((err, req, res, next) => {
    console.error("Unexpected server error:", err);
    res.status(500).send("Internal Server Error");
});

// ------------------- Start Server -------------------
app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
});
