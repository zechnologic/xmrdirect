import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getUserById } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
  isAdmin?: boolean;
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: "Access token required",
      });
      return;
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          error: "Invalid or expired token",
        });
      }

      const payload = decoded as { userId: string; username: string };

      // Verify user still exists
      const user = getUserById(payload.userId);
      if (!user) {
        return res.status(403).json({
          success: false,
          error: "User not found",
        });
      }

      req.userId = payload.userId;
      req.username = payload.username;
      next();
    });
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication failed",
    });
  }
};
