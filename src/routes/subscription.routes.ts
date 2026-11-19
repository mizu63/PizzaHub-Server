
import { Router } from "express";

import {
  createSubscription,
} from "../controllers/subscription.controller.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

// Vendor only: Start Premium Subscription
router.post(
  "/create-checkout",
  authenticate,
  authorizeRoles("vendor"),
  createSubscription
);

export default router;
