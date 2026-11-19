
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

      const email =
        session.customer_details?.email ??
        session.customer_email;

      if (!vendorId || !subscriptionId || !email) {
        console.error("Missing subscription information:", session.id);

        res.status(400).send("Missing subscription information");
        return;
      }

      const stripe = getStripe();

      const subscription = await stripe.subscriptions.retrieve(
        subscriptionId
      );

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

      const db = getDB();

      // Prevent duplicate processing of the same Checkout Session
      const existingTransaction = await db
        .collection("transactions")
        .findOne({
          stripeSessionId: session.id,
        });

      if (existingTransaction) {
        res.status(200).json({
          received: true,
          message: "Transaction already processed",
        });
        return;
      }

      // Confirm that the account is the intended vendor
      const vendor = await db.collection("user").findOne({
        email,
        role: "vendor",
      });

      if (!vendor) {
        console.error("Vendor not found for subscription:", vendorId);

        res.status(400).send("Vendor account not found");
        return;
      }

      const periodEnd = subscription.items.data[0]?.current_period_end;

      const subscriptionExpiresAt = periodEnd
        ? new Date(periodEnd * 1000)
        : undefined;

      await db.collection("transactions").insertOne({
        vendorId,
        plan: "premium",
        amount: (session.amount_total ?? 0) / 100,
        currency: session.currency ?? "usd",
        stripeSessionId: session.id,
        stripeSubscriptionId: subscriptionId,
        status: "completed",
        createdAt: new Date(),
      });

      await db.collection("user").updateOne(
        {
          email,
          role: "vendor",
        },
        {
          $set: {
            subscriptionPlan: "premium",
            ...(subscriptionExpiresAt
              ? { subscriptionExpiresAt }
              : {}),
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
