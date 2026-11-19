
import { Router } from "express";

import {
  getVendorProfile,
  updateVendorProfile,
} from "../controllers/vendor.controller.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

// All vendor routes require vendor authentication
router.use(authenticate, authorizeRoles("vendor"));

// Get own vendor profile
router.get("/profile", getVendorProfile);

// Update business profile
router.patch("/profile", updateVendorProfile);

export default router;
