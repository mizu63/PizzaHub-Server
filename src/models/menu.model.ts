
import type { ObjectId } from "mongodb";

export type MenuItemStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "inactive";

export interface MenuItem {
  _id?: ObjectId;
  vendorId: string;
  itemName: string;
  category: string;
  description: string;
  price: number;
  location: string;
  images: string[];
  status: MenuItemStatus;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateMenuItemInput {
  itemName: string;
  category: string;
  description: string;
  price: number;
  location: string;
  images: string[];
}
