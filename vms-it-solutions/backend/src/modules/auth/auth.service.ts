import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { hashPassword, verifyPassword } from "../../utils/password";
import { env } from "../../config/env";
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
} from "../../utils/jwt";

const userWithPerms = {
  include: {
    role: { include: { permissions: { include: { permission: true } } } },
  },
} as const;

function permsOf(user: { role: { slug: string; permissions: { permission: { resource: string; action: string } }[] } }) {
  return user.role.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`);
}

async function issueTokens(userId: string, meta: { ip?: string; userAgent?: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, ...userWithPerms });
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role.slug,
    perms: permsOf(user),
    tv: user.tokenVersion,
  });

  const { token: refreshToken, tokenHash } = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      expiresAt: new Date(Date.now() + env.refreshTokenTtlDays * 86_400_000),
    },
  });

  return { accessToken, refreshToken, user: publicUser(user) };
}

function publicUser(user: {
  id: string; email: string; firstName: string; lastName: string;
  avatarUrl: string | null; department: string | null; designation: string | null;
  role: { name: string; slug: string };
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    department: user.department,
    designation: user.designation,
    role: { name: user.role.name, slug: user.role.slug },
  };
}

export const authService = {
  async login(email: string, password: string, meta: { ip?: string; userAgent?: string }) {
    const user = await prisma.user.findUnique({ where: { email }, ...userWithPerms });
    const ok = user ? await verifyPassword(password, user.password) : false;

    await prisma.loginLog.create({
      data: { userId: user?.id, email, success: Boolean(ok && user?.isActive && !user?.isLocked), ip: meta.ip, userAgent: meta.userAgent },
    });

    if (!user || !ok) throw ApiError.unauthorized("Incorrect email or password");
    if (!user.isActive) throw ApiError.forbidden("Your account has been deactivated");
    if (user.isLocked) throw ApiError.forbidden("Your account is locked — contact an administrator");

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return issueTokens(user.id, meta);
  },

  /** Rotating refresh: old token is revoked, a new pair is issued. Reuse of a revoked token revokes the whole session family. */
  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }) {
    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) throw ApiError.unauthorized("Invalid session");

    if (stored.revokedAt) {
      // Token reuse — likely theft. Kill every session for this user.
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw ApiError.unauthorized("Session revoked for security — please sign in again");
    }
    if (stored.expiresAt < new Date()) throw ApiError.unauthorized("Session expired");

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return issueTokens(stored.userId, meta);
  },

  async logout(refreshToken?: string) {
    if (!refreshToken) return;
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, ...userWithPerms });
    if (!user) throw ApiError.notFound("User not found");
    return { ...publicUser(user), permissions: permsOf(user) };
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(currentPassword, user.password))) {
      throw ApiError.badRequest("Current password is incorrect");
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: await hashPassword(newPassword),
        tokenVersion: { increment: 1 }, // invalidate all existing access tokens
      },
    });
    await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  },
};
