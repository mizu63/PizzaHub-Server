
import { Router } from "express";

import {
  getAllMenuItemsForAdmin,
  updateMenuItemStatus,
  getAdminDashboardStats,
  getAllTransactions,
} from "../controllers/admin.controller.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

// All admin routes require admin authentication
router.use(authenticate, authorizeRoles("admin"));

// Admin: Get Dashboard Statistics
router.get("/stats", getAdminDashboardStats);

// Admin: Get all transactions
router.get("/transactions", getAllTransactions);

// Admin: Get all menu items
router.get("/menu", getAllMenuItemsForAdmin);

// Admin: Approve, reject, or deactivate menu item
router.patch("/menu/:id/status", updateMenuItemStatus);

export default router;
