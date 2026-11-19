
import { Router } from "express";

import {
  getMyProfile,
  updateMyProfile,
} from "../controllers/profile.controller.js";

import {
  authenticate,
} from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

// Get own profile
router.get("/", getMyProfile);

// Update own profile
router.patch("/", updateMyProfile);

export default router;
