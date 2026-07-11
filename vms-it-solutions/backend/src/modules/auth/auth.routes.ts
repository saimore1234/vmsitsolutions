import { Router } from "express";
import { authController } from "./auth.controller";
import { validate } from "../../middleware/validate";
import { loginSchema, changePasswordSchema } from "./auth.validation";
import { requireAuth } from "../../middleware/auth";
import { authLimiter } from "../../middleware/rateLimit";

export const authRoutes = Router();

authRoutes.post("/login", authLimiter, validate(loginSchema), authController.login);
authRoutes.post("/refresh", authController.refresh);
authRoutes.post("/logout", authController.logout);
authRoutes.get("/me", requireAuth, authController.me);
authRoutes.post("/change-password", requireAuth, validate(changePasswordSchema), authController.changePassword);
