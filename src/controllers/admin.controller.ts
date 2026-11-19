
import type { RequestHandler } from "express";
import { ObjectId } from "mongodb";

import { getDB } from "../config/db.js";
import type {
  MenuItem,
  MenuItemStatus,
} from "../models/menu.model.js";

const getMenuCollection = () =>
  getDB().collection<MenuItem>("menuItems");

// Admin: Get all menu items
export const getAllMenuItemsForAdmin: RequestHandler = async (
  req,
  res
) => {
  try {
    const { status } = req.query;

    const filter: Record<string, unknown> = {};

    if (
      typeof status === "string" &&
      ["pending", "approved", "rejected", "inactive"].includes(status)
    ) {
      filter.status = status;
    }

    const items = await getMenuCollection()
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      total: items.length,
      data: items,
    });
  } catch (error) {
    console.error("Admin Get Menu Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch menu items",
    });
  }
};

// Admin: Update menu item status
export const updateMenuItemStatus: RequestHandler = async (
  req,
  res
) => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid menu item ID",
      });
      return;
    }

    const { status } = req.body as {
      status?: unknown;
    };

    const allowedStatuses: MenuItemStatus[] = [
      "pending",
      "approved",
      "rejected",
      "inactive",
    ];

    if (
      typeof status !== "string" ||
      !allowedStatuses.includes(status as MenuItemStatus)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid menu item status",
      });
      return;
    }

    const result = await getMenuCollection().updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          status: status as MenuItemStatus,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Menu item ${status} successfully`,
    });
  } catch (error) {
    console.error("Admin Update Menu Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update menu item status",
    });
  }
};


