
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

// Vendor: Get own menu items
// Must be before /:id
router.get(
  "/vendor/my-items",
  authenticate,
  authorizeRoles("vendor"),
  getMyMenuItems
);

// Public: Get a single approved menu item
router.get("/:id", getMenuItemById);

// Vendor: Create a menu item
router.post(
  "/",
  authenticate,
  authorizeRoles("vendor"),
  createMenuItem
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
