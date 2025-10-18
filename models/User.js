import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // password will be empty for Google login users
  googleId: { type: String }, // used only if signup via google
  profileImage: { type: String }, // Google DP or null for manual
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);
