
import { Router } from "express";

import {
  uploadImage,
} from "../controllers/image.controller.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

// Only authenticated vendors and admins can upload images
router.post(
  "/upload",
  authenticate,
  authorizeRoles("vendor", "admin"),
  uploadImage
);

export default router;
