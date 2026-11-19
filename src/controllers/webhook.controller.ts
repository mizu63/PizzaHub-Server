
import type { RequestHandler } from "express";
import Stripe from "stripe";

import { getDB } from "../config/db.js";

const getStripe = (): Stripe => {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is missing");
  }

  return new Stripe(secretKey);
};

// Update vendor subscription
const updateVendorSubscription = async (
  subscription: Stripe.Subscription
) => {
  const vendorId = subscription.metadata?.vendorId;

  if (!vendorId) {
    throw new Error("Vendor ID missing from subscription metadata");
  }

  const db = getDB();

  const vendor = await db.collection("user").findOne({
    id: vendorId,
    role: "vendor",
  });

  if (!vendor) {
    throw new Error(`Vendor not found: ${vendorId}`);
  }

  const isActive =
    subscription.status === "active" ||
    subscription.status === "trialing";

  const periodEnd =
    subscription.items.data[0]?.current_period_end;

  const updateData: Record<string, unknown> = {
    subscriptionPlan: isActive ? "premium" : "free",
    updatedAt: new Date(),
  };

  if (isActive && periodEnd) {
    updateData.subscriptionExpiresAt = new Date(
      periodEnd * 1000
    );
  } else {
    updateData.subscriptionExpiresAt = null;
  }

  await db.collection("user").updateOne(
    {
      id: vendorId,
      role: "vendor",
    },
    {
      $set: updateData,
    }
  );
};

// Stripe Webhook
export const stripeWebhook: RequestHandler = async (
  req,
  res
) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (
    typeof signature !== "string" ||
    !webhookSecret ||
    !Buffer.isBuffer(req.body)
  ) {
    res.status(400).send("Invalid webhook request");
    return;
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("Stripe Signature Error:", error);

    res.status(400).send("Webhook signature verification failed");
    return;
  }

  try {
    const db = getDB();

    // 1. Checkout completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (
        session.mode !== "subscription" ||
        session.metadata?.plan !== "premium"
      ) {
        res.status(200).json({ received: true });
        return;
      }

      const vendorId = session.metadata.vendorId;

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (!vendorId || !subscriptionId) {
        res.status(400).send("Missing subscription information");
        return;
      }

      const subscription = await getStripe()
        .subscriptions.retrieve(subscriptionId);

      if (subscription.metadata.vendorId !== vendorId) {
        res.status(400).send("Subscription vendor mismatch");
        return;
      }

      if (
        subscription.status !== "active" &&
        subscription.status !== "trialing"
      ) {
        res.status(200).json({
          received: true,
          message: "Subscription is not active",
        });
        return;
      }

      const vendor = await db.collection("user").findOne({
        id: vendorId,
        role: "vendor",
      });

      if (!vendor) {
        res.status(400).send("Vendor account not found");
        return;
      }

      await db.collection("transactions").updateOne(
        { stripeSessionId: session.id },
        {
          $setOnInsert: {
            vendorId,
            plan: "premium",
            amount: (session.amount_total ?? 0) / 100,
            currency: session.currency ?? "usd",
            stripeSessionId: session.id,
            stripeSubscriptionId: subscriptionId,
            status: "completed",
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      await updateVendorSubscription(subscription);
    }

    // 2. Subscription updated
    else if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;

      await updateVendorSubscription(subscription);
    }

    // 3. Subscription deleted
    else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;

      const vendorId = subscription.metadata?.vendorId;

      if (!vendorId) {
        res.status(400).send("Vendor ID missing");
        return;
      }

      await db.collection("user").updateOne(
        {
          id: vendorId,
          role: "vendor",
        },
        {
          $set: {
            subscriptionPlan: "free",
            subscriptionExpiresAt: null,
            updatedAt: new Date(),
          },
        }
      );

      await db.collection("transactions").updateMany(
        {
          stripeSubscriptionId: subscription.id,
          status: "completed",
        },
        {
          $set: {
            status: "cancelled",
            updatedAt: new Date(),
          },
        }
      );
    }

    res.status(200).json({
      received: true,
    });
  } catch (error) {
    console.error("Stripe Webhook Processing Error:", error);

    res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};
