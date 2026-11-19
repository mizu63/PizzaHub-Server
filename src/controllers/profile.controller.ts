
import type { RequestHandler } from "express";

import { getDB } from "../config/db.js";
import type { AuthenticatedUser } from "../middleware/auth.middleware.js";

const getUser = (res: Parameters<RequestHandler>[1]) =>
  res.locals.user as AuthenticatedUser;

// Get logged-in user's profile
export const getMyProfile: RequestHandler = async (_req, res) => {
  try {
    const user = getUser(res);

    const profile = await getDB().collection("user").findOne(
      { id: user.id },
      {
        projection: {
          _id: 0,
          id: 1,
          name: 1,
          email: 1,
          image: 1,
          role: 1,
          businessName: 1,
          subscriptionPlan: 1,
          subscriptionExpiresAt: 1,
          isBlocked: 1,
        },
      }
    );

    if (!profile) {
      res.status(404).json({
        success: false,
        message: "Profile not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("Get Profile Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};

// Update logged-in user's profile
export const updateMyProfile: RequestHandler = async (req, res) => {
  try {
    const user = getUser(res);

    const {
      name,
      image,
    } = req.body as {
      name?: unknown;
      image?: unknown;
    };

    const updates: Record<string, string | Date> = {};

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 80
      ) {
        res.status(400).json({
          success: false,
          message: "Name must be between 1 and 80 characters",
        });
        return;
      }

      updates.name = name.trim();
    }

    if (image !== undefined) {
      if (
        typeof image !== "string" ||
        (image.trim() !== "" &&
          !/^https?:\/\/\S+$/i.test(image.trim()))
      ) {
        res.status(400).json({
          success: false,
          message: "Please provide a valid profile image URL",
        });
        return;
      }

      updates.image = image.trim();
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        message: "Please provide name or image to update",
      });
      return;
    }

    updates.updatedAt = new Date();

    const result = await getDB()
      .collection("user")
      .updateOne(
        { id: user.id },
        { $set: updates }
      );

    if (result.matchedCount === 0) {
      res.status(404).json({
        success: false,
        message: "Profile not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update Profile Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};
