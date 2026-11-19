
import { Router } from "express";

import {
  getAllTransactions,
  getTransactionStats,
} from "../controllers/transaction.controller.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

// Admin authentication required
router.use(authenticate, authorizeRoles("admin"));

// Get transaction statistics
router.get("/stats", getTransactionStats);

// Get all transactions
router.get("/", getAllTransactions);

export default router;
