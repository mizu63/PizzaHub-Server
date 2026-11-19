
import Stripe from "stripe";

const getStripe = (): Stripe => {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is missing");
  }

  return new Stripe(secretKey);
};

interface CreateCheckoutInput {
  vendorId: string;
  email: string;
}

export const createPremiumCheckoutSession = async ({
  vendorId,
  email,
}: CreateCheckoutInput): Promise<Stripe.Checkout.Session> => {
  const stripe = getStripe();

  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
  const clientUrl = process.env.CLIENT_URL;

  if (!priceId) {
    throw new Error("STRIPE_PREMIUM_PRICE_ID is missing");
  }

  if (!clientUrl) {
    throw new Error("CLIENT_URL is missing");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",

    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],

    customer_email: email,

    metadata: {
      vendorId,
      plan: "premium",
    },

    subscription_data: {
      metadata: {
        vendorId,
        plan: "premium",
      },
    },

    success_url: `${clientUrl}/dashboard/subscription/success?session_id={CHECKOUT_SESSION_ID}`,

    cancel_url: `${clientUrl}/dashboard/subscription/cancel`,
  });

  return session;
};
