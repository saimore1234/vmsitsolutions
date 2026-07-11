import { Request, Response } from "express";
import { authService } from "./auth.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { env } from "../../config/env";
import { logActivity } from "../../middleware/activityLog";

const REFRESH_COOKIE = "vms_refresh";

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: env.refreshTokenTtlDays * 86_400_000,
  });
}

export const authController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password, { ip: req.ip, userAgent: req.headers["user-agent"] });
    setRefreshCookie(res, result.refreshToken);
    res.json({ success: true, data: { accessToken: result.accessToken, user: result.user } });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    const result = await authService.refresh(token ?? "", { ip: req.ip, userAgent: req.headers["user-agent"] });
    setRefreshCookie(res, result.refreshToken);
    res.json({ success: true, data: { accessToken: result.accessToken, user: result.user } });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
    if (req.auth) logActivity(req, "logout", "auth", req.auth.sub);
    res.json({ success: true, message: "Signed out" });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await authService.me(req.auth!.sub) });
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.changePassword(req.auth!.sub, req.body.currentPassword, req.body.newPassword);
    logActivity(req, "password_changed", "auth", req.auth!.sub);
    res.json({ success: true, message: "Password updated — sign in again on other devices" });
  }),
};
