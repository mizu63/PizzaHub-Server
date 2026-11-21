
import type { RequestHandler } from "express";
import Stripe from "stripe";
import { ObjectId } from "mongodb";

import { getDB } from "../config/db.js";

const getStripe = (): Stripe => {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is missing");
  }

  return new Stripe(secretKey);
};

// Find vendor using Better Auth user ID
const findVendor = async (vendorId: string) => {
  const db = getDB();

  const conditions: Record<string, unknown>[] = [
    { id: vendorId },
  ];

  if (ObjectId.isValid(vendorId)) {
    conditions.push({ _id: new ObjectId(vendorId) });
  }

  return db.collection("user").findOne({
    $or: conditions,
    role: "vendor",
  });
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
  const vendor = await findVendor(vendorId);

  if (!vendor) {
    throw new Error("Vendor account not found for subscription");
  }

  const isActive =
    subscription.status === "active" ||
    subscription.status === "trialing";

  const periodEnd =
    subscription.items.data[0]?.current_period_end;

  const updateData: Record<string, unknown> = {
    subscriptionPlan: isActive ? "premium" : "free",
    updatedAt: new Date(),
    subscriptionExpiresAt:
      isActive && periodEnd
        ? new Date(periodEnd * 1000)
        : null,
  };

  await db.collection("user").updateOne(
    { _id: vendor._id },
    { $set: updateData }
  );

  console.log(
    `Vendor subscription updated: ${vendorId} -> ${
      isActive ? "premium" : "free"
    }`
  );
};

// Stripe Webhook
export const stripeWebhook: RequestHandler = async (
  req,
  res
) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Verify raw body and signature
  if (
    typeof signature !== "string" ||
    !webhookSecret ||
    !Buffer.isBuffer(req.body)
  ) {
    console.error("Invalid webhook request");
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

      console.log("Checkout session completed:", session.id);

      if (session.mode !== "subscription") {
        res.status(200).json({ received: true });
        return;
      }

      const vendorId = session.metadata?.vendorId;
      const plan = session.metadata?.plan;

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (!vendorId || !subscriptionId) {
        console.error("Missing subscription information:", {
          hasVendorId: Boolean(vendorId),
          hasSubscriptionId: Boolean(subscriptionId),
        });

        res.status(400).send("Missing subscription information");
        return;
      }

      if (plan !== "premium") {
        console.error("Invalid subscription plan:", plan);
        res.status(400).send("Invalid subscription plan");
        return;
      }

      // Retrieve Stripe subscription
      const subscription = await getStripe()
        .subscriptions.retrieve(subscriptionId);

      if (
        subscription.metadata?.vendorId &&
        subscription.metadata.vendorId !== vendorId
      ) {
        console.error("Subscription vendor mismatch");
        res.status(400).send("Subscription vendor mismatch");
        return;
      }

      // Find vendor
      const vendor = await findVendor(vendorId);

      if (!vendor) {
        console.error("Vendor account not found:", vendorId);
        res.status(400).send("Vendor account not found");
        return;
      }

      // Save transaction only after Stripe confirms active subscription
      if (
        subscription.status === "active" ||
        subscription.status === "trialing"
      ) {
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

        console.log("Premium transaction saved:", session.id);
      } else {
        console.log(
          "Subscription is not active:",
          subscription.status
        );
      }
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

      if (vendorId) {
        const vendor = await findVendor(vendorId);

        if (vendor) {
          await db.collection("user").updateOne(
            { _id: vendor._id },
            {
              $set: {
                subscriptionPlan: "free",
                subscriptionExpiresAt: null,
                updatedAt: new Date(),
              },
            }
          );
        }
      }

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

      console.log("Subscription cancelled:", subscription.id);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe Webhook Processing Error:", error);

    res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};
