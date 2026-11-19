import "dotenv/config";
import testRoutes from "./routes/test.routes.js";
import express from "express";
import cors from "cors";
import menuRoutes from "./routes/menu.routes.js";
import { connectDB } from "./config/db.js";
import { auth } from "./config/auth.js";
import { toNodeHandler } from "better-auth/node";
import adminRoutes from "./routes/admin.routes.js";
import orderRoutes from "./routes/order.routes.js";
import vendorRoutes from "./routes/vendor.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import userRoutes from "./routes/user.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import imageRoutes from "./routes/image.routes.js";
const app = express();
app.use("/api/test", testRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/users", userRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/images", imageRoutes);
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.get("/", (_req, res) => {
  res.status(200).send("PizzaHub Server is Running!");
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "PizzaHub API is healthy",
  });
});

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`PizzaHub Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server Startup Failed:", error);
    process.exit(1);
  }
};

startServer();