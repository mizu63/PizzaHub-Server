
import type { RequestHandler } from "express";
import { ObjectId } from "mongodb";

import { getDB } from "../config/db.js";
import type {
  MenuItem,
  CreateMenuItemInput,
} from "../models/menu.model.js";
import type { AuthenticatedUser } from "../middleware/auth.middleware.js";

const getUser = (res: Parameters<RequestHandler>[1]) =>
  res.locals.user as AuthenticatedUser;

const getMenuCollection = () =>
  getDB().collection<MenuItem>("menuItems");

// Get all approved menu items with search, filter and sorting

// Get all approved menu items with search, filter and sorting
export const getAllMenuItems: RequestHandler = async (req, res) => {
  try {
    const { search, category, location, sort } = req.query;

    const filter: Record<string, unknown> = {
      status: "approved",
    };

    // Escape special regex characters
    const escapeRegex = (value: string) =>
      value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Search by item name, category, location and description
    if (typeof search === "string" && search.trim()) {
      const searchRegex = {
        $regex: escapeRegex(search.trim()),
        $options: "i",
      };

      filter.$or = [
        { itemName: searchRegex },
        { category: searchRegex },
        { location: searchRegex },
        { description: searchRegex },
      ];
    }

    // Filter by category
    if (typeof category === "string" && category.trim()) {
      filter.category = {
        $regex: `^${escapeRegex(category.trim())}$`,
        $options: "i",
      };
    }

    // Filter by location
    if (typeof location === "string" && location.trim()) {
      filter.location = {
        $regex: escapeRegex(location.trim()),
        $options: "i",
      };
    }

    // Price sorting
    let sortOption: Record<string, 1 | -1> = {
      createdAt: -1,
    };

    if (sort === "price-asc") {
      sortOption = { price: 1 };
    } else if (sort === "price-desc") {
      sortOption = { price: -1 };
    }

    const items = await getMenuCollection()
      .find(filter)
      .sort(sortOption)
      .toArray();

    res.status(200).json({
      success: true,
      total: items.length,
      data: items,
    });
  } catch (error) {
    console.error("Get Menu Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch menu items",
    });
  }
};


// Get single menu item
export const getMenuItemById: RequestHandler = async (
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

    if (!ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid menu item ID",
      });
      return;
    }

    const item = await getMenuCollection().findOne({
      _id: new ObjectId(id),
      status: "approved",
    });

    if (!item) {
      res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error("Get Menu Item Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch menu item",
    });
  }
};

// Create menu item - Vendor only
export const createMenuItem: RequestHandler = async (
  req,
  res
) => {
  try {
    const user = getUser(res);

    const {
      itemName,
      category,
      description,
      price,
      location,
      images,
    } = req.body as CreateMenuItemInput;

    if (
      !itemName?.trim() ||
      !category?.trim() ||
      !description?.trim() ||
      !location?.trim() ||
      !Array.isArray(images) ||
      !images.every((image) => typeof image === "string") ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      res.status(400).json({
        success: false,
        message: "Please provide valid menu item information",
      });
      return;
    }

    const newItem: MenuItem = {
      vendorId: user.id,
      itemName: itemName.trim(),
      category: category.trim(),
      description: description.trim(),
      price,
      location: location.trim(),
      images,
      status: "pending",
      createdAt: new Date(),
    };

    const result = await getMenuCollection().insertOne(newItem);

    res.status(201).json({
      success: true,
      message: "Menu item submitted for approval",
      data: {
        ...newItem,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("Create Menu Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create menu item",
    });
  }
};

// Vendor gets own menu items
export const getMyMenuItems: RequestHandler = async (
  _req,
  res
) => {
  try {
    const user = getUser(res);

    const items = await getMenuCollection()
      .find({ vendorId: user.id })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      total: items.length,
      data: items,
    });
  } catch (error) {
    console.error("Get My Menu Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch your menu items",
    });
  }
};

// Vendor updates own menu item
export const updateMenuItem: RequestHandler = async (
  req,
  res
) => {
  try {
    const user = getUser(res);
   const id = req.params.id;

if (typeof id !== "string" || !ObjectId.isValid(id)) {
  res.status(400).json({
    success: false,
    message: "Invalid menu item ID",
  });
  return;
}

    if (!ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid menu item ID",
      });
      return;
    }

    const {
      itemName,
      category,
      description,
      price,
      location,
      images,
    } = req.body as Partial<CreateMenuItemInput>;

    if (
      (itemName !== undefined &&
        (typeof itemName !== "string" || !itemName.trim())) ||
      (category !== undefined &&
        (typeof category !== "string" || !category.trim())) ||
      (description !== undefined &&
        (typeof description !== "string" || !description.trim())) ||
      (location !== undefined &&
        (typeof location !== "string" || !location.trim())) ||
      (price !== undefined &&
        (typeof price !== "number" ||
          !Number.isFinite(price) ||
          price <= 0)) ||
      (images !== undefined &&
        (!Array.isArray(images) ||
          !images.every((image) => typeof image === "string")))
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid menu item information",
      });
      return;
    }

    const updates: Partial<MenuItem> = {
      updatedAt: new Date(),
      status: "pending",
    };

    if (itemName !== undefined) updates.itemName = itemName.trim();
    if (category !== undefined) updates.category = category.trim();
    if (description !== undefined) updates.description = description.trim();
    if (price !== undefined) updates.price = price;
    if (location !== undefined) updates.location = location.trim();
    if (images !== undefined) updates.images = images;

    const result = await getMenuCollection().updateOne(
      {
        _id: new ObjectId(id),
        vendorId: user.id,
      },
      {
        $set: updates,
      }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({
        success: false,
        message: "Menu item not found or access denied",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Menu item updated and sent for approval",
    });
  } catch (error) {
    console.error("Update Menu Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update menu item",
    });
  }
};

// Vendor deletes own menu item
export const deleteMenuItem: RequestHandler = async (
  req,
  res
) => {
  try {
    const user = getUser(res);
   const id = req.params.id;

if (typeof id !== "string" || !ObjectId.isValid(id)) {
  res.status(400).json({
    success: false,
    message: "Invalid menu item ID",
  });
  return;
}

    if (!ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid menu item ID",
      });
      return;
    }

    const result = await getMenuCollection().deleteOne({
      _id: new ObjectId(id),
      vendorId: user.id,
    });

    if (result.deletedCount === 0) {
      res.status(404).json({
        success: false,
        message: "Menu item not found or access denied",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    console.error("Delete Menu Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete menu item",
    });
  }
};
