import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env";

export interface AccessPayload {
  sub: string;          // user id
  role: string;         // role slug
  perms: string[];      // ["leads:view", "blogs:edit", ...]
  tv: number;           // token version — bump to force logout
}

export function signAccessToken(payload: AccessPayload) {
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.accessTokenTtl } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessPayload;
}

/** Refresh tokens are opaque random strings; only a SHA-256 hash is stored. */
export function generateRefreshToken() {
  const token = crypto.randomBytes(48).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
