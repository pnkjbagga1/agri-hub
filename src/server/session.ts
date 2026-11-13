import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import type { RoleKey } from "@/lib/constants";
import { clientIp } from "./security";

export const SESSION_COOKIE = "ah_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const ADMIN_MAX_AGE = 60 * 60 * 8; // admins re-authenticate every 8h
const cookiePath = () => (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(s);
}

type Claims = { sub: string; sv: number; jti: string };

/**
 * Issues a signed JWT bound to a server-side Session row (jti), so a single device
 * can be signed out for real and members can review/revoke their devices.
 */
export async function createSession(user: { id: string; sessionVersion: number; role: RoleKey }) {
  const maxAge = user.role === "admin" ? ADMIN_MAX_AGE : MAX_AGE;
  const h = await headers();
  const session = await db.session.create({
    data: { userId: user.id, userAgent: h.get("user-agent")?.slice(0, 300) ?? null, ip: clientIp(h), expiresAt: new Date(Date.now() + maxAge * 1000) },
  });
  const token = await new SignJWT({ sv: user.sessionVersion, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setJti(session.id)
    .setIssuedAt()
    .setIssuer("agri-hub")
    .setAudience("agri-hub-web")
    .setExpirationTime(`${maxAge}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: cookiePath(), maxAge });
}

async function readClaims(): Promise<Claims | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "agri-hub", audience: "agri-hub-web", algorithms: ["HS256"] });
    if (!payload.sub || !payload.jti) return null;
    return { sub: payload.sub, sv: payload.sv as number, jti: payload.jti };
  } catch {
    return null;
  }
}

/** Signs out this device: revokes its session row and clears the cookie. */
export async function destroySession() {
  const claims = await readClaims();
  if (claims) await db.session.updateMany({ where: { id: claims.jti, revokedAt: null }, data: { revokedAt: new Date() } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: cookiePath(), maxAge: 0 });
}

/** Revokes every session for a user (password change, suspension, "sign out everywhere"). */
export async function revokeAllSessions(userId: string) {
  await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/**
 * The signed-in user, re-checked against the database on every request so
 * suspensions, revoked sessions and role changes take effect immediately.
 */
export const getSessionUser = cache(async () => {
  const claims = await readClaims();
  if (!claims) return null;
  const session = await db.session.findUnique({
    where: { id: claims.jti },
    include: { user: { include: { profile: { include: { region: true } } } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date() || session.userId !== claims.sub) return null;
  const user = session.user;
  if (user.status !== "active" || user.sessionVersion !== claims.sv) return null;
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return Object.assign(user, { sessionId: session.id });
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
