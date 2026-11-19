
import type { RequestHandler } from "express";
import { ObjectId } from "mongodb";

import { getDB } from "../config/db.js";
import type {
  Order,
  CreateOrderInput,
  OrderStatus,
} from "../models/order.model.js";
import type { MenuItem } from "../models/menu.model.js";
import type { AuthenticatedUser } from "../middleware/auth.middleware.js";

const getUser = (res: Parameters<RequestHandler>[1]) =>
  res.locals.user as AuthenticatedUser;

const getOrderCollection = () =>
  getDB().collection<Order>("orders");

const getMenuCollection = () =>
  getDB().collection<MenuItem>("menuItems");

// Customer: Create a new order
export const createOrder: RequestHandler = async (req, res) => {
  try {
    const user = getUser(res);

    const {
      itemId,
      deliveryDate,
      deliveryAddress,
      message,
    } = req.body as CreateOrderInput;

    if (
      typeof itemId !== "string" ||
      !ObjectId.isValid(itemId) ||
      typeof deliveryDate !== "string" ||
      !deliveryDate.trim() ||
      typeof deliveryAddress !== "string" ||
      !deliveryAddress.trim() ||
      (message !== undefined && typeof message !== "string")
    ) {
      res.status(400).json({
        success: false,
        message: "Please provide valid order information",
      });
      return;
    }

    const parsedDate = new Date(deliveryDate);

    if (Number.isNaN(parsedDate.getTime())) {
      res.status(400).json({
        success: false,
        message: "Invalid delivery date",
      });
      return;
    }

    const menuItem = await getMenuCollection().findOne({
      _id: new ObjectId(itemId),
      status: "approved",
    });

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: "Menu item not found or unavailable",
      });
      return;
    }

    if (menuItem.vendorId === user.id) {
      res.status(403).json({
        success: false,
        message: "You cannot order your own menu item",
      });
      return;
    }

    const newOrder: Order = {
      itemId,
      vendorId: menuItem.vendorId,
      customerId: user.id,
      deliveryDate: parsedDate,
      deliveryAddress: deliveryAddress.trim(),
      message: message?.trim(),
      status: "pending",
      createdAt: new Date(),
    };

    const result = await getOrderCollection().insertOne(newOrder);

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: {
        ...newOrder,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("Create Order Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to place order",
    });
  }
};

// Customer: Get own orders
export const getMyOrders: RequestHandler = async (_req, res) => {
  try {
    const user = getUser(res);

    const orders = await getOrderCollection()
      .find({ customerId: user.id })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      total: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("Get My Orders Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch your orders",
    });
  }
};

// Customer: Cancel own pending order
export const cancelOrder: RequestHandler = async (req, res) => {
  try {
    const user = getUser(res);
    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
      return;
    }

    const result = await getOrderCollection().updateOne(
      {
        _id: new ObjectId(id),
        customerId: user.id,
        status: "pending",
      },
      {
        $set: {
          status: "cancelled",
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({
        success: false,
        message: "Pending order not found or access denied",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel Order Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
    });
  }
};

// Vendor: Get incoming orders
export const getVendorOrders: RequestHandler = async (
  _req,
  res
) => {
  try {
    const user = getUser(res);

    const orders = await getOrderCollection()
      .find({ vendorId: user.id })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      total: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("Get Vendor Orders Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch incoming orders",
    });
  }
};

// Vendor: Accept or reject a pending order
export const updateOrderStatus: RequestHandler = async (
  req,
  res
) => {
  try {
    const user = getUser(res);
    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
      return;
    }

    const { status } = req.body as {
      status?: unknown;
    };

    const allowedStatuses: OrderStatus[] = [
      "accepted",
      "rejected",
    ];

    if (
      typeof status !== "string" ||
      !allowedStatuses.includes(status as OrderStatus)
    ) {
      res.status(400).json({
        success: false,
        message: "Status must be accepted or rejected",
      });
      return;
    }

    const result = await getOrderCollection().updateOne(
      {
        _id: new ObjectId(id),
        vendorId: user.id,
        status: "pending",
      },
      {
        $set: {
          status: status as OrderStatus,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({
        success: false,
        message: "Pending order not found or access denied",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Order ${status} successfully`,
    });
  } catch (error) {
    console.error("Update Order Status Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
};
