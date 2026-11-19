
import type { RequestHandler } from "express";
import { ObjectId } from "mongodb";

import { getDB } from "../config/db.js";

interface UserRecord {
  _id?: ObjectId;
  id?: string;
  name?: string;
  email?: string;
  image?: string;
  role?: string;
  isBlocked?: boolean;
  businessName?: string;
  subscriptionPlan?: string;
  createdAt?: Date;
}

// Admin: Get all users
export const getAllUsers: RequestHandler = async (
  req,
  res
) => {
  try {
    const { role, search } = req.query;

    const filter: Record<string, unknown> = {};

    if (
      typeof role === "string" &&
      ["customer", "vendor", "admin"].includes(role)
    ) {
      filter.role = role;
    }

    if (typeof search === "string" && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const users = await getDB()
      .collection<UserRecord>("user")
      .find(filter)
      .project({
        name: 1,
        email: 1,
        image: 1,
        role: 1,
        isBlocked: 1,
        businessName: 1,
        subscriptionPlan: 1,
        createdAt: 1,
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      total: users.length,
      data: users,
    });
  } catch (error) {
    console.error("Get All Users Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

// Admin: Block or unblock a user

export const updateUserBlockStatus: RequestHandler = async (
  req,
  res
) => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !id.trim()) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
      return;
    }

    const { isBlocked } = req.body as {
      isBlocked?: unknown;
    };

    if (typeof isBlocked !== "boolean") {
      res.status(400).json({
        success: false,
        message: "isBlocked must be true or false",
      });
      return;
    }

    // Prevent admin from blocking their own account
    const currentAdmin = res.locals.user as {
      id: string;
      role: string;
    };

    if (id === currentAdmin.id && isBlocked === true) {
      res.status(403).json({
        success: false,
        message: "You cannot block your own admin account",
      });
      return;
    }

    const result = await getDB()
      .collection<UserRecord>("user")
      .updateOne(
        { id },
        {
          $set: {
            isBlocked,
            updatedAt: new Date(),
          },
        }
      );

    if (result.matchedCount === 0) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: isBlocked
        ? "User blocked successfully"
        : "User unblocked successfully",
    });
  } catch (error) {
    console.error("Update User Block Status Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update user status",
    });
  }
};
