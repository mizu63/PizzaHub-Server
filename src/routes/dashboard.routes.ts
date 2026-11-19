
import { Router } from "express";

import {
  getCustomerDashboard,
  getVendorDashboard,
  getAdminDashboard,
} from "../controllers/dashboard.controller.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

// Customer Dashboard
router.get(
  "/customer",
  authenticate,
  authorizeRoles("customer"),
  getCustomerDashboard
);

// Vendor Dashboard
router.get(
  "/vendor",
  authenticate,
  authorizeRoles("vendor"),
  getVendorDashboard
);

// Admin Dashboard
router.get(
  "/admin",
  authenticate,
  authorizeRoles("admin"),
  getAdminDashboard
);

export default router;
