
import type { RequestHandler } from "express";

import { getDB } from "../config/db.js";
import type { AuthenticatedUser } from "../middleware/auth.middleware.js";

const getUser = (res: Parameters<RequestHandler>[1]) =>
  res.locals.user as AuthenticatedUser;

// Customer Dashboard Statistics
export const getCustomerDashboard: RequestHandler = async (
  _req,
  res
) => {
  try {
    const user = getUser(res);
    const orders = getDB().collection("orders");

    const [totalOrders, pendingOrders, acceptedOrders, rejectedOrders, cancelledOrders] =
      await Promise.all([
        orders.countDocuments({ customerId: user.id }),
        orders.countDocuments({ customerId: user.id, status: "pending" }),
        orders.countDocuments({ customerId: user.id, status: "accepted" }),
        orders.countDocuments({ customerId: user.id, status: "rejected" }),
        orders.countDocuments({ customerId: user.id, status: "cancelled" }),
      ]);

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        acceptedOrders,
        rejectedOrders,
        cancelledOrders,
      },
    });
  } catch (error) {
    console.error("Customer Dashboard Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch customer dashboard",
    });
  }
};

// Vendor Dashboard Statistics
export const getVendorDashboard: RequestHandler = async (
  _req,
  res
) => {
  try {
    const user = getUser(res);
    const db = getDB();

    const menuItems = db.collection("menuItems");
    const orders = db.collection("orders");

    const [
      totalMenuItems,
      pendingMenuItems,
      approvedMenuItems,
      totalOrders,
      pendingOrders,
      acceptedOrders,
      rejectedOrders,
    ] = await Promise.all([
      menuItems.countDocuments({ vendorId: user.id }),
      menuItems.countDocuments({ vendorId: user.id, status: "pending" }),
      menuItems.countDocuments({ vendorId: user.id, status: "approved" }),
      orders.countDocuments({ vendorId: user.id }),
      orders.countDocuments({ vendorId: user.id, status: "pending" }),
      orders.countDocuments({ vendorId: user.id, status: "accepted" }),
      orders.countDocuments({ vendorId: user.id, status: "rejected" }),
    ]);

    const vendor = await db.collection("user").findOne(
      { email: user.email },
      {
        projection: {
          businessName: 1,
          subscriptionPlan: 1,
          subscriptionExpiresAt: 1,
        },
      }
    );

    res.status(200).json({
      success: true,
      data: {
        totalMenuItems,
        pendingMenuItems,
        approvedMenuItems,
        totalOrders,
        pendingOrders,
        acceptedOrders,
        rejectedOrders,
        businessName: vendor?.businessName ?? null,
        subscriptionPlan: vendor?.subscriptionPlan ?? "free",
        subscriptionExpiresAt: vendor?.subscriptionExpiresAt ?? null,
      },
    });
  } catch (error) {
    console.error("Vendor Dashboard Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch vendor dashboard",
    });
  }
};

// Admin Dashboard Statistics
export const getAdminDashboard: RequestHandler = async (
  _req,
  res
) => {
  try {
    const db = getDB();

    const users = db.collection("user");
    const menuItems = db.collection("menuItems");
    const orders = db.collection("orders");
    const transactions = db.collection("transactions");

    const [
      totalUsers,
      totalCustomers,
      totalVendors,
      totalMenuItems,
      pendingMenuItems,
      approvedMenuItems,
      totalOrders,
      pendingOrders,
      totalTransactions,
      completedTransactions,
    ] = await Promise.all([
      users.countDocuments(),
      users.countDocuments({ role: "customer" }),
      users.countDocuments({ role: "vendor" }),
      menuItems.countDocuments(),
      menuItems.countDocuments({ status: "pending" }),
      menuItems.countDocuments({ status: "approved" }),
      orders.countDocuments(),
      orders.countDocuments({ status: "pending" }),
      transactions.countDocuments(),
      transactions.countDocuments({ status: "completed" }),
    ]);

    const revenueResult = await transactions
      .aggregate([
        { $match: { status: "completed" } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
          },
        },
      ])
      .toArray();

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalCustomers,
        totalVendors,
        totalMenuItems,
        pendingMenuItems,
        approvedMenuItems,
        totalOrders,
        pendingOrders,
        totalTransactions,
        completedTransactions,
        totalRevenue: revenueResult[0]?.totalRevenue ?? 0,
      },
    });
  } catch (error) {
    console.error("Admin Dashboard Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch admin dashboard",
    });
  }
};
