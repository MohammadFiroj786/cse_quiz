// middleware/auth.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export function verifyToken(req, res, next) {
  const auth = req.headers.authorization || req.body.token || req.query.token;
  if (!auth) return res.status(401).json({ message: "No token provided" });

  const token = auth.startsWith("Bearer ") ? auth.split(" ")[1] : auth;

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid token" });
    req.user = decoded; // { id, email, iat, exp }
    next();
  });
}
