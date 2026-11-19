
import { Router } from "express";

import {
  getAllUsers,
  updateUserBlockStatus,
} from "../controllers/user.controller.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

// Admin authentication required
router.use(authenticate, authorizeRoles("admin"));

// Get all users with optional role and search filters
router.get("/", getAllUsers);

// Block or unblock a user
router.patch("/:id/block", updateUserBlockStatus);

export default router;
