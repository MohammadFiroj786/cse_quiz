import mongoose from "mongoose";

const scoreSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String, required: true },
  subject: { type: String, required: true },
  score: { type: Number, required: true },
  total: { type: Number, required: true },
  monthKey: { type: String, required: true }, // e.g., "2025-10"
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Score || mongoose.model("Score", scoreSchema);
