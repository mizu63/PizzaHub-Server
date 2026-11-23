
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

    const menuCollection = getMenuCollection();
    const menuItemId = new ObjectId(id);

    // Find menu item
    const menuItem = await menuCollection.findOne({
      _id: menuItemId,
    });

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
      return;
    }

    // Check limit only when a new approval is requested
    if (status === "approved" && menuItem.status !== "approved") {
      const vendorId = menuItem.vendorId;

      const vendorConditions: Record<string, unknown>[] = [
        { id: vendorId },
      ];

      if (ObjectId.isValid(vendorId)) {
        vendorConditions.push({
          _id: new ObjectId(vendorId),
        });
      }

      // Find vendor
      const vendor = await getDB()
        .collection("user")
        .findOne({
          $or: vendorConditions,
          role: "vendor",
        });

      if (!vendor) {
        res.status(404).json({
          success: false,
          message: "Vendor account not found",
        });
        return;
      }

      // Check active premium subscription
      const expiresAt = vendor.subscriptionExpiresAt
        ? new Date(vendor.subscriptionExpiresAt as string | number)
        : null;

      const isPremium =
        vendor.subscriptionPlan === "premium" &&
        expiresAt !== null &&
        !Number.isNaN(expiresAt.getTime()) &&
        expiresAt.getTime() > Date.now();

      // Free plan: maximum 3 approved items
      if (!isPremium) {
        const approvedCount = await menuCollection.countDocuments({
          vendorId,
          status: "approved",
        });

        if (approvedCount >= 3) {
          res.status(403).json({
            success: false,
            message:
              "Free plan allows only 3 approved menu items. Upgrade to Premium for unlimited menu items.",
            approvedCount,
            limit: 3,
            subscriptionPlan: "free",
          });
          return;
        }
      }
    }

    // Update menu item status
    const result = await menuCollection.updateOne(
      {
        _id: menuItemId,
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

// Admin: Get Dashboard Statistics
export const getAdminDashboardStats: RequestHandler = async (
  _req,
  res
) => {
  try {
    const db = getDB();

    const usersCollection = db.collection("user");
    const menuCollection = getMenuCollection();
    const transactionsCollection = db.collection("transactions");

    const [
      totalUsers,
      customers,
      vendors,
      admins,
      totalMenuItems,
      pendingMenuItems,
      approvedMenuItems,
      totalTransactions,
      revenueResult,
    ] = await Promise.all([
      usersCollection.countDocuments(),
      usersCollection.countDocuments({
        $or: [
          { role: "customer" },
          { role: { $exists: false } },
          { role: null },
          { role: "" },
        ],
      }),
      usersCollection.countDocuments({ role: "vendor" }),
      usersCollection.countDocuments({ role: "admin" }),
      menuCollection.countDocuments(),
      menuCollection.countDocuments({ status: "pending" }),
      menuCollection.countDocuments({ status: "approved" }),
      transactionsCollection.countDocuments(),
      transactionsCollection
        .aggregate([
          { $match: { status: "completed" } },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" },
            },
          },
        ])
        .toArray(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        customers,
        vendors,
        admins,
        totalMenuItems,
        pendingMenuItems,
        approvedMenuItems,
        totalTransactions,
        totalRevenue: revenueResult[0]?.total ?? 0,
      },
    });
  } catch (error) {
    console.error("Admin Dashboard Stats Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
    });
  }
};




interface TransactionRecord {
  _id: ObjectId;
  vendorId: string;
  plan: string;
  amount: number;
  currency: string;
  stripeSessionId: string;
  stripeSubscriptionId: string;
  status: string;
  createdAt: Date;
}

// Admin: Get All Transactions
export const getAllTransactions: RequestHandler = async (
  _req,
  res
) => {
  try {
    const db = getDB();

    const transactions = await db
      .collection<TransactionRecord>("transactions")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    const vendorIds = [
      ...new Set(transactions.map((item) => item.vendorId)),
    ];

    const validObjectIds = vendorIds
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const vendors = await db
      .collection("user")
      .find({
        $or: [
          { id: { $in: vendorIds } },
          { _id: { $in: validObjectIds } },
        ],
      })
      .toArray();

    const vendorMap = new Map(
      vendors.map((vendor) => [
        vendor._id?.toString() || vendor.id,
        {
          name: vendor.name || "Unknown Vendor",
          email: vendor.email || "N/A",
          businessName: vendor.businessName || "N/A",
        },
      ])
    );

    const formattedTransactions = transactions.map(
      (transaction) => ({
        ...transaction,
        vendor:
          vendorMap.get(transaction.vendorId) || {
            name: "Unknown Vendor",
            email: "N/A",
            businessName: "N/A",
          },
      })
    );

    res.status(200).json({
      success: true,
      total: formattedTransactions.length,
      data: formattedTransactions,
    });
  } catch (error) {
    console.error("Admin Get Transactions Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
    });
  }
};







// interface TransactionRecord {
//   _id: ObjectId;
//   vendorId: string;
//   plan: string;
//   amount: number;
//   currency: string;
//   stripeSessionId: string;
//   stripeSubscriptionId: string;
//   status: string;
//   createdAt: Date;
// }

// // Admin: Get All Transactions
// export const getAllTransactions: RequestHandler = async (
//   req,
//   res
// ) => {
//   try {
//     const db = getDB();

//     const transactionsCollection =
//       db.collection<TransactionRecord>("transactions");

//     const transactions = await transactionsCollection
//       .find({})
//       .sort({ createdAt: -1 })
//       .toArray();

//     const vendorIds = [
//       ...new Set(transactions.map((item) => item.vendorId)),
//     ];

//     const vendors = await db
//       .collection("user")
//       .find(
//         { id: { $in: vendorIds } },
//         {
//           projection: {
//             name: 1,
//             email: 1,
//             businessName: 1,
//           },
//         }
//       )
//       .toArray();

//     const vendorMap = new Map(
//       vendors.map((vendor) => [
//         vendor.id,
//         {
//           name: vendor.name,
//           email: vendor.email,
//           businessName: vendor.businessName,
//         },
//       ])
//     );

//     const formattedTransactions = transactions.map(
//       (transaction) => ({
//         ...transaction,
//         vendor: vendorMap.get(transaction.vendorId) || null,
//       })
//     );

//     res.status(200).json({
//       success: true,
//       total: formattedTransactions.length,
//       data: formattedTransactions,
//     });
//   } catch (error) {
//     console.error("Admin Get Transactions Error:", error);

//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch transactions",
//     });
//   }
// };
