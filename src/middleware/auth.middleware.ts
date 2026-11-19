
import type { RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { getDB } from "../config/db.js";

const authUrl = process.env.BETTER_AUTH_URL;

if (!authUrl) {
  throw new Error("BETTER_AUTH_URL is missing");
}

const JWKS = createRemoteJWKSet(
  new URL("/api/auth/jwks", authUrl)
);

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

export const authenticate: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const token = authorization.slice(7);

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: authUrl,
      audience: authUrl,
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid user information",
      });
      return;
    }

    // Check current user status from MongoDB
    const dbUser = await getDB()
      .collection("user")
      .findOne(
        { id: payload.sub },
        {
          projection: {
            email: 1,
            role: 1,
            isBlocked: 1,
          },
        }
      );

    if (!dbUser) {
      res.status(401).json({
        success: false,
        message: "User account not found",
      });
      return;
    }

    if (dbUser.isBlocked === true) {
      res.status(403).json({
        success: false,
        message: "Your account has been blocked",
      });
      return;
    }

    // Use current database role, not only the JWT role
    if (
      typeof dbUser.email !== "string" ||
      typeof dbUser.role !== "string" ||
      dbUser.email !== payload.email
    ) {
      res.status(401).json({
        success: false,
        message: "User information does not match",
      });
      return;
    }

    res.locals.user = {
      id: payload.sub,
      email: dbUser.email,
      role: dbUser.role,
    } satisfies AuthenticatedUser;

    next();
  } catch (error) {
    console.error("Authentication Error:", error);

    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export const authorizeRoles = (
  ...allowedRoles: string[]
): RequestHandler => {
  return (_req, res, next) => {
    const user = res.locals.user as
      | AuthenticatedUser
      | undefined;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: "You do not have permission",
      });
      return;
    }

    next();
  };
};
