
import { Router } from "express";

import {
  getAllMenuItems,
  getMenuItemById,
  createMenuItem,
  getMyMenuItems,
  updateMenuItem,
  deleteMenuItem,
} from "../controllers/menu.controller.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

// Public: Get all approved menu items
router.get("/", getAllMenuItems);

// Public: Get a single approved menu item
router.get("/:id", getMenuItemById);

// Vendor: Create a menu item
router.post(
  "/",
  authenticate,
  authorizeRoles("vendor"),
  createMenuItem
);

// Vendor: Get own menu items
router.get(
  "/vendor/my-items",
  authenticate,
  authorizeRoles("vendor"),
  getMyMenuItems
);

// Vendor: Update own menu item
router.patch(
  "/:id",
  authenticate,
  authorizeRoles("vendor"),
  updateMenuItem
);

// Vendor: Delete own menu item
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("vendor"),
  deleteMenuItem
);

export default router;
