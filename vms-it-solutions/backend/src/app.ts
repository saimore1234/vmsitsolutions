import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import path from "path";
import { env } from "./config/env";
import { apiV1 } from "./routes";
import { apiLimiter } from "./middleware/rateLimit";
import { errorHandler, notFound } from "./middleware/error";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));
  app.use("/uploads", express.static(path.resolve(env.uploadDir), { maxAge: "7d", immutable: true }));

  app.use("/api/v1", apiLimiter, apiV1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
