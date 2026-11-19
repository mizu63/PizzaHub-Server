
import type { RequestHandler } from "express";

import { getDB } from "../config/db.js";
import type { AuthenticatedUser } from "../middleware/auth.middleware.js";

interface VendorProfile {
  name?: string;
  email?: string;
  role?: string;
  businessName?: string;
  image?: string;
}

const getUser = (res: Parameters<RequestHandler>[1]) =>
  res.locals.user as AuthenticatedUser;

const getUsersCollection = () =>
  getDB().collection<VendorProfile>("user");

// Vendor: Get own profile
export const getVendorProfile: RequestHandler = async (
  _req,
  res
) => {
  try {
    const user = getUser(res);

    const vendor = await getUsersCollection().findOne(
      { email: user.email },
      {
        projection: {
          name: 1,
          email: 1,
          role: 1,
          businessName: 1,
          image: 1,
        },
      }
    );

    if (!vendor || vendor.role !== "vendor") {
      res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    console.error("Get Vendor Profile Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch vendor profile",
    });
  }
};

// Vendor: Update business name
export const updateVendorProfile: RequestHandler = async (
  req,
  res
) => {
  try {
    const user = getUser(res);

    const { businessName } = req.body as {
      businessName?: unknown;
    };

    if (
      typeof businessName !== "string" ||
      !businessName.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid business name",
      });
      return;
    }

    const result = await getUsersCollection().updateOne(
      {
        email: user.email,
        role: "vendor",
      },
      {
        $set: {
          businessName: businessName.trim(),
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Business profile updated successfully",
    });
  } catch (error) {
    console.error("Update Vendor Profile Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update vendor profile",
    });
  }
};
