
import type { RequestHandler } from "express";

import { createPremiumCheckoutSession } from "../services/stripe.service.js";
import type { AuthenticatedUser } from "../middleware/auth.middleware.js";

const getUser = (res: Parameters<RequestHandler>[1]) =>
  res.locals.user as AuthenticatedUser;

// Vendor: Create Premium Subscription Checkout
export const createSubscription: RequestHandler = async (
  _req,
  res
) => {
  try {
    const user = getUser(res);

    const session = await createPremiumCheckoutSession({
      vendorId: user.id,
      email: user.email,
    });

    if (!session.url) {
      res.status(500).json({
        success: false,
        message: "Unable to create Stripe checkout session",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Checkout session created successfully",
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
      },
    });
  } catch (error) {
    console.error("Create Subscription Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create subscription checkout",
    });
  }
};
