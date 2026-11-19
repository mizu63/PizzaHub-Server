
import { Router } from "express";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

router.get("/profile", authenticate, (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Authentication successful",
    user: res.locals.user,
  });
});

router.get(
  "/admin",
  authenticate,
  authorizeRoles("admin"),
  (_req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome Admin",
    });
  }
);

export default router;
