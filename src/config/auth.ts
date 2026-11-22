
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { jwt } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { ObjectId } from "mongodb";

import { getDB, getMongoClient } from "./db.js";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

// Find a user by MongoDB ID
const findUserById = async (userId: string) => {
  if (!ObjectId.isValid(userId)) {
    return null;
  }

  return getDB()
    .collection("user")
    .findOne({ _id: new ObjectId(userId) });
};
// Check whether a user is blocked
const checkBlockedUser = async (user: any) => {
  if (user?.isBlocked === true) {
    throw new APIError("FORBIDDEN", {
      message: "Your account has been blocked.",
    });
  }
};

export const auth = betterAuth({
  database: mongodbAdapter(getDB(), {
    client: getMongoClient(),
  }),

  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  trustedOrigins: [
    process.env.CLIENT_URL || "http://localhost:3000",
  ],

  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
  },


  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },

  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {},

  user: {
    additionalFields: {
      role: {
        type: ["customer", "vendor", "admin"],
        required: false,
        defaultValue: "customer",
        input: true,
      },

      isBlocked: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },

      businessName: {
        type: "string",
        required: false,
        input: false,
      },

      subscriptionPlan: {
        type: "string",
        required: false,
        defaultValue: "free",
        input: false,
      },

      subscriptionExpiresAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },

  // Check blocked users before Better Auth endpoints
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Email/password login
      if (ctx.path === "/sign-in/email") {
        const email = ctx.body?.email;

        if (typeof email === "string") {
          const user = await getDB()
            .collection("user")
            .findOne({ email });

          await checkBlockedUser(user);
        }
      }

      // Existing session and JWT requests
      if (
        ctx.path === "/get-session" ||
        ctx.path === "/token"
      ) {
        const cookieName =
          ctx.context.authCookies.sessionToken.name;

        const token = ctx.getCookie(cookieName);

        if (token) {
          const session = await getDB()
            .collection("session")
            .findOne({ token });

          if (session) {
            const user = await findUserById(
              session.userId.toString()
            );

            await checkBlockedUser(user);
          }
        }
      }
    }),
  },

  // Prevent blocked users from creating new sessions
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await findUserById(
            session.userId.toString()
          );

          if (user?.isBlocked === true) {
            throw new APIError("FORBIDDEN", {
              message: "Your account has been blocked.",
            });
          }

          return {
            data: session,
          };
        },
      },
    },
  },

  plugins: [
    jwt({
      jwt: {
        definePayload: ({ user }) => ({
          id: user.id,
          email: user.email,
          role: user.role,
        }),
      },
    }),
  ],
});
