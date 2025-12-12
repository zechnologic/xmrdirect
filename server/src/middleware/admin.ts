import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.js";

const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || "")
  .split(",")
  .map((username) => username.trim())
  .filter((username) => username.length > 0);

export const isAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.userId || !req.username) {
    res.status(401).json({
      success: false,
      error: "Authentication required",
    });
    return;
  }

  if (ADMIN_USERNAMES.includes(req.username)) {
    req.isAdmin = true;
    next();
  } else {
    res.status(403).json({
      success: false,
      error: "Admin access required",
    });
  }
};
