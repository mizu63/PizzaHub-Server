
import type { ObjectId } from "mongodb";

export type OrderStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled";

export interface Order {
  _id?: ObjectId;
  itemId: string;
  vendorId: string;
  customerId: string;
  deliveryDate: Date;
  deliveryAddress: string;
  message?: string;
  status: OrderStatus;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateOrderInput {
  itemId: string;
  deliveryDate: string;
  deliveryAddress: string;
  message?: string;
}
