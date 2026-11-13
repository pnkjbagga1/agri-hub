import { z } from "zod";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { handler, body, fail, zReqText, zOptText } from "@/server/api";
import { createSession, destroySession, revokeAllSessions } from "@/server/session";
import { hashPassword, verifyPassword, passwordProblem, newTotpSecret, verifyTotp, totpUri, rateLimit } from "@/server/security";
import { consumeToken, issueToken, peekToken, sendVerificationEmail, uniqueProfileSlug } from "@/server/accounts";
import { audit, notifyAdmins, sendEmail, track } from "@/server/notify";
import { MEMBER_ROLES, PARTNER_ROLES, type RoleKey } from "@/lib/constants";

const SIGNUP_ROLES = [...MEMBER_ROLES, ...PARTNER_ROLES] as [RoleKey, ...RoleKey[]];

const signupSchema = z.object({
  role: z.enum(SIGNUP_ROLES),
  orgName: zReqText(120, 2),
  contactName: zReqText(80, 2),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || /^[+()\d\s.-]{7,}$/.test(v), "Enter a valid phone number"),
  city: zOptText(80),
  regionId: zOptText(40),
  buyerType: zOptText(30),
  password: z.string().min(1).max(128),
  acceptTerms: z.literal(true, { message: "Please accept the terms" }),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(160),
  password: z.string().max(128),
  portal: z.enum(["member", "partner", "admin"]),
  totp: z.string().max(10).optional(),
});

// Verified against unknown emails so response time doesn't reveal which accounts exist.
const DUMMY_HASH = hashPassword("timing-equaliser-not-a-real-password-42");
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;

function portalFor(role: string) {
  if (role === "admin") return "admin";
  return PARTNER_ROLES.includes(role as RoleKey) ? "partner" : "member";
}
const PORTAL_PATH = { member: "/login", partner: "/partners/login", admin: "/admin/login" } as const;

export const POST = handler<{ action: string }>({ rateLimit: [30, 60], name: "auth" }, async ({ req, params, user, ip }) => {
  switch (params.action) {
    case "signup": {
      const rl = rateLimit(`signup:${ip}`, 8, 3600_000);
      if (!rl.ok) fail(429, "Too many sign-ups from this network. Try again later.", { retryAfter: rl.retryAfter });
      const data = await body(req, signupSchema);
      const problem = passwordProblem(data.password, data.email);
      if (problem) fail(422, problem, { password: problem });
      if (await db.user.findUnique({ where: { email: data.email } })) fail(409, "An account with this email already exists. Try signing in.", { email: "Already registered" });
      const region = data.regionId ? await db.region.findUnique({ where: { id: data.regionId } }) : null;
      const created = await db.user.create({
        data: {
          email: data.email,
          phone: data.phone,
          role: data.role,
          passwordHash: await hashPassword(data.password),
          passwordChangedAt: new Date(),
          profile: {
            create: {
              slug: await uniqueProfileSlug(data.orgName),
              orgName: data.orgName,
              contactName: data.contactName,
              city: data.city,
              regionId: region?.id,
              lat: region?.lat,
              lng: region?.lng,
              buyerType: data.role === "buyer" ? data.buyerType : null,
            },
          },
        },
      });
      await sendVerificationEmail(created);
      await createSession({ id: created.id, sessionVersion: created.sessionVersion, role: created.role as RoleKey });
      await track("signup", { userId: created.id, meta: { role: created.role } });
      await notifyAdmins({ type: "new_member", title: `New ${created.role.replace("_", " ")} joined: ${data.orgName}`, link: `/admin/users/${created.id}` });
      await audit(created.id, "user.signup", "user", created.id, { role: created.role });
      return { ok: true, next: "/onboarding" };
    }

    case "login": {
      const data = await body(req, loginSchema);
      const rl = rateLimit(`login:${ip}:${data.email}`, 10, 15 * 60_000);
      if (!rl.ok) fail(429, "Too many attempts. Please wait and try again.", { retryAfter: rl.retryAfter });
      const u = await db.user.findUnique({ where: { email: data.email } });
      // constant-ish time: always run a verify even for unknown emails
      const ok = u ? await verifyPassword(u.passwordHash, data.password) : (await verifyPassword(await DUMMY_HASH, data.password), false);
      if (u?.lockedUntil && u.lockedUntil > new Date()) fail(423, `Account temporarily locked after repeated failed attempts. Try again after ${u.lockedUntil.toLocaleTimeString("en-CA", { timeZone: "America/Vancouver" })}.`);
      if (!u || !ok) {
        if (u) {
          const fails = u.failedLogins + 1;
          await db.user.update({ where: { id: u.id }, data: { failedLogins: fails, lockedUntil: fails >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60000) : null } });
          if (fails === LOCK_AFTER) {
            await sendEmail(u.email, "AGRI HUB account locked", [`We locked your account for ${LOCK_MINUTES} minutes after ${LOCK_AFTER} failed sign-in attempts.`, "If this wasn't you, reset your password."], { label: "Reset password", href: "/forgot-password" });
            await audit(u.id, "user.locked", "user", u.id, { ip });
          }
        }
        fail(401, "Email or password is incorrect.");
      }
      if (u!.status !== "active") fail(403, "This account is suspended. Contact support@griscanada.org.");
      const portal = portalFor(u!.role);
      if (portal !== data.portal) {
        fail(403, `This account uses the ${portal === "admin" ? "admin" : portal === "partner" ? "stakeholder partner" : "member"} sign-in.`, { portal, href: PORTAL_PATH[portal] });
      }
      let totpStep: number | null = null;
      if (u!.totpEnabled) {
        if (!data.totp) return { needTotp: true };
        totpStep = verifyTotp(u!.totpSecret!, data.totp, u!.totpLastStep);
        if (totpStep === null) {
          // wrong codes count toward the same lockout as wrong passwords
          const fails = u!.failedLogins + 1;
          await db.user.update({ where: { id: u!.id }, data: { failedLogins: fails, lockedUntil: fails >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60000) : null } });
          fail(401, "That authentication code is not valid or was already used.", { totp: "Invalid code" });
        }
      }
      await db.user.update({ where: { id: u!.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date(), ...(totpStep !== null && { totpLastStep: totpStep }) } });
      await createSession({ id: u!.id, sessionVersion: u!.sessionVersion, role: u!.role as RoleKey });
      await audit(u!.id, "user.login", "user", u!.id, { ip, portal });
      return { ok: true, role: u!.role, next: u!.role === "admin" ? "/admin" : "/dashboard", totpRecommended: u!.role === "admin" && !u!.totpEnabled };
    }

    case "logout": {
      await destroySession();
      return { ok: true };
    }

    case "logout-all": {
      if (!user) fail(401, "Please sign in.");
      await db.user.update({ where: { id: user!.id }, data: { sessionVersion: { increment: 1 } } });
      await revokeAllSessions(user!.id);
      await destroySession();
      await audit(user!.id, "user.logout_all", "user", user!.id);
      return { ok: true };
    }

    case "verify-email": {
      const { token } = await body(req, z.object({ token: z.string().min(10).max(200) }));
      const userId = await consumeToken(token, "verify_email");
      if (!userId) fail(400, "This link is invalid or has expired. Request a new one from your settings.");
      await db.user.update({ where: { id: userId! }, data: { emailVerifiedAt: new Date() } });
      return { ok: true };
    }

    case "resend-verification": {
      if (!user) fail(401, "Please sign in.");
      if (user!.emailVerifiedAt) return { ok: true, already: true };
      const rl = rateLimit(`resend:${user!.id}`, 3, 3600_000);
      if (!rl.ok) fail(429, "Please wait before requesting another email.", { retryAfter: rl.retryAfter });
      await sendVerificationEmail(user!);
      return { ok: true };
    }

    case "forgot": {
      const { email } = await body(req, z.object({ email: z.string().trim().toLowerCase().max(160) }));
      const rl = rateLimit(`forgot:${ip}`, 5, 3600_000);
      if (!rl.ok) fail(429, "Too many requests. Try again later.", { retryAfter: rl.retryAfter });
      const u = await db.user.findUnique({ where: { email } });
      if (u && u.status === "active") {
        const raw = await issueToken(u.id, "reset_password", 30);
        await sendEmail(u.email, "Reset your AGRI HUB password", ["We received a request to reset your password. The link expires in 30 minutes.", "If you didn't ask for this you can ignore this email."], {
          label: "Choose a new password",
          href: `/reset-password?token=${raw}`,
        });
      }
      // same response either way, so this can't be used to discover accounts
      return { ok: true };
    }

    case "reset": {
      const data = await body(req, z.object({ token: z.string().min(10).max(200), password: z.string().max(128) }));
      // validate first so a weak password doesn't burn the single-use link
      const peeked = await peekToken(data.token, "reset_password");
      if (!peeked) fail(400, "This reset link is invalid or has expired.");
      const u = await db.user.findUniqueOrThrow({ where: { id: peeked! } });
      const problem = passwordProblem(data.password, u.email);
      if (problem) fail(422, problem, { password: problem });
      if (!(await consumeToken(data.token, "reset_password"))) fail(400, "This reset link is invalid or has expired.");
      await db.user.update({
        where: { id: u.id },
        data: { passwordHash: await hashPassword(data.password), passwordChangedAt: new Date(), sessionVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null, emailVerifiedAt: u.emailVerifiedAt ?? new Date() },
      });
      await revokeAllSessions(u.id);
      await sendEmail(u.email, "Your AGRI HUB password was changed", ["Your password was just reset and all other sessions were signed out.", "If this wasn't you, contact support@griscanada.org immediately."]);
      await audit(u.id, "user.password_reset", "user", u.id);
      return { ok: true, portalHref: PORTAL_PATH[portalFor(u.role)] };
    }

    case "change-password": {
      if (!user) fail(401, "Please sign in.");
      const data = await body(req, z.object({ current: z.string().max(128), password: z.string().max(128) }));
      if (!(await verifyPassword(user!.passwordHash, data.current))) fail(401, "Current password is incorrect.", { current: "Incorrect" });
      const problem = passwordProblem(data.password, user!.email);
      if (problem) fail(422, problem, { password: problem });
      const updated = await db.user.update({ where: { id: user!.id }, data: { passwordHash: await hashPassword(data.password), passwordChangedAt: new Date(), sessionVersion: { increment: 1 } } });
      await revokeAllSessions(user!.id);
      await createSession({ id: updated.id, sessionVersion: updated.sessionVersion, role: updated.role as RoleKey });
      await sendEmail(user!.email, "Your AGRI HUB password was changed", ["Your password was changed and your other devices were signed out."]);
      await audit(user!.id, "user.password_change", "user", user!.id);
      return { ok: true };
    }

    case "totp-setup": {
      if (!user) fail(401, "Please sign in.");
      if (user!.totpEnabled) fail(409, "Two-factor authentication is already on.");
      const secret = newTotpSecret();
      await db.user.update({ where: { id: user!.id }, data: { totpSecret: secret } });
      const uri = totpUri(secret, user!.email);
      return { secret, uri, qrSvg: await QRCode.toString(uri, { type: "svg", margin: 1, color: { dark: "#1A2B1A", light: "#ffffff" } }) };
    }

    case "totp-enable": {
      if (!user) fail(401, "Please sign in.");
      const { code } = await body(req, z.object({ code: z.string().max(10) }));
      const step = user!.totpSecret ? verifyTotp(user!.totpSecret, code) : null;
      if (step === null) fail(422, "That code didn't match. Check your authenticator app's time.", { code: "Invalid code" });
      await db.user.update({ where: { id: user!.id }, data: { totpEnabled: true, totpLastStep: step } });
      await audit(user!.id, "user.totp_enabled", "user", user!.id);
      return { ok: true };
    }

    case "totp-disable": {
      if (!user) fail(401, "Please sign in.");
      const data = await body(req, z.object({ code: z.string().max(10), password: z.string().max(128) }));
      if (!(await verifyPassword(user!.passwordHash, data.password))) fail(401, "Password is incorrect.", { password: "Incorrect" });
      if (!user!.totpSecret || verifyTotp(user!.totpSecret, data.code, user!.totpLastStep) === null) fail(422, "Invalid authentication code.", { code: "Invalid code" });
      await db.user.update({ where: { id: user!.id }, data: { totpEnabled: false, totpSecret: null, totpLastStep: null } });
      await audit(user!.id, "user.totp_disabled", "user", user!.id);
      return { ok: true };
    }
  }
  fail(404, "Unknown action.");
});

export const GET = handler<{ action: string }>({}, async ({ params, user }) => {
  if (params.action !== "me") fail(404, "Unknown action.");
  if (!user) return { user: null };
  const { passwordHash: _p, totpSecret: _t, totpLastStep: _s, ...safe } = user;
  void _s;
  void _p;
  void _t;
  return { user: safe };
});
