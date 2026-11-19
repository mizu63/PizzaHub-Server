
import { Router } from "express";

import {
  createOrder,
  getMyOrders,
  cancelOrder,
  getVendorOrders,
  updateOrderStatus,
} from "../controllers/order.controller.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

// All order routes require authentication
router.use(authenticate);

// Customer routes
router.post(
  "/",
  authorizeRoles("customer"),
  createOrder
);

router.get(
  "/my-orders",
  authorizeRoles("customer"),
  getMyOrders
);

router.patch(
  "/:id/cancel",
  authorizeRoles("customer"),
  cancelOrder
);

// Vendor routes
router.get(
  "/vendor",
  authorizeRoles("vendor"),
  getVendorOrders
);

router.patch(
  "/:id/status",
  authorizeRoles("vendor"),
  updateOrderStatus
);

export default router;
