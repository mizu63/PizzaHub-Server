
import type { RequestHandler } from "express";

import { getDB } from "../config/db.js";
import type { Transaction } from "../models/transaction.model.js";

// Admin: Get all transactions
export const getAllTransactions: RequestHandler = async (
  req,
  res
) => {
  try {
    const { status, vendorId } = req.query;

    const filter: Record<string, unknown> = {};

    if (
      typeof status === "string" &&
      ["pending", "completed", "failed", "cancelled"].includes(status)
    ) {
      filter.status = status;
    }

    if (typeof vendorId === "string" && vendorId.trim()) {
      filter.vendorId = vendorId.trim();
    }

    const transactions = await getDB()
      .collection<Transaction>("transactions")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      total: transactions.length,
      data: transactions,
    });
  } catch (error) {
    console.error("Get Transactions Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
    });
  }
};

// Admin: Get transaction statistics
export const getTransactionStats: RequestHandler = async (
  _req,
  res
) => {
  try {
    const collection = getDB().collection<Transaction>("transactions");

    const stats = await collection
      .aggregate([
        {
          $group: {
            _id: "$status",
            totalTransactions: { $sum: 1 },
            totalRevenue: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "completed"] },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
      ])
      .toArray();

    const totalTransactions = stats.reduce(
      (sum, item) => sum + Number(item.totalTransactions ?? 0),
      0
    );

    const totalRevenue = stats.reduce(
      (sum, item) => sum + Number(item.totalRevenue ?? 0),
      0
    );

    res.status(200).json({
      success: true,
      data: {
        totalTransactions,
        totalRevenue,
        breakdown: stats,
      },
    });
  } catch (error) {
    console.error("Transaction Stats Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch transaction statistics",
    });
  }
};
