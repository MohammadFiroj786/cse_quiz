require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const port = 5000;

// ✅ Load API key from .env file (DO NOT hardcode it)
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PPLX_API_URL = "https://api.perplexity.ai/chat/completions";

app.use(express.static("public"));
app.use(cors());
app.use(express.json());

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
            PPLX_API_URL,
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
                    Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const content = pplxResponse.data.choices[0].message.content.trim();

        let questions;
        try {
            questions = JSON.parse(content);
            if (!Array.isArray(questions)) {
                throw new Error("Response is not a JSON array");
            }
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

app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
});
