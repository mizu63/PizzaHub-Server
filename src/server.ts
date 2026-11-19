import "dotenv/config";
import testRoutes from "./routes/test.routes.js";
import express from "express";
import cors from "cors";

import { connectDB } from "./config/db.js";
import { auth } from "./config/auth.js";
import { toNodeHandler } from "better-auth/node";

const app = express();
app.use("/api/test", testRoutes);
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