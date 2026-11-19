
import { Router, raw } from "express";

import {
  stripeWebhook,
} from "../controllers/webhook.controller.js";

const router = Router();

// Stripe requires the raw request body for signature verification
router.post(
  "/stripe",
  raw({ type: "application/json" }),
  stripeWebhook
);

export default router;
