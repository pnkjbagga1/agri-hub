import "server-only";
import { db } from "@/lib/db";
import { newToken, sha256 } from "./security";
import { sendEmail } from "./notify";
import { slugify, randomSuffix } from "@/lib/utils";

export async function issueToken(userId: string, type: "verify_email" | "reset_password", ttlMinutes: number) {
  const t = newToken();
  // one live token per purpose
  await db.token.deleteMany({ where: { userId, type, usedAt: null } });
  await db.token.create({ data: { userId, type, tokenHash: t.hash, expiresAt: new Date(Date.now() + ttlMinutes * 60000) } });
  return t.raw;
}

/** Look a token up without using it, so a validation error doesn't burn the link. */
export async function peekToken(raw: string, type: "verify_email" | "reset_password") {
  const token = await db.token.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!token || token.type !== type || token.usedAt || token.expiresAt < new Date()) return null;
  return token.userId;
}

/** Atomically marks the token used: only one concurrent request can succeed. */
export async function consumeToken(raw: string, type: "verify_email" | "reset_password") {
  const hash = sha256(raw);
  const used = await db.token.updateMany({ where: { tokenHash: hash, type, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  if (!used.count) return null;
  const token = await db.token.findUnique({ where: { tokenHash: hash } });
  return token?.userId ?? null;
}

export async function sendVerificationEmail(user: { id: string; email: string }) {
  const raw = await issueToken(user.id, "verify_email", 60 * 24);
  await sendEmail(user.email, "Confirm your AGRI HUB email", ["Welcome to AGRI HUB — BC's agri-food connection platform.", "Please confirm your email address to unlock messaging and listings."], {
    label: "Confirm email",
    href: `/verify-email?token=${raw}`,
  });
}

export async function uniqueProfileSlug(name: string) {
  const base = slugify(name) || "member";
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${randomSuffix(4)}`;
    if (!(await db.profile.findUnique({ where: { slug } }))) return slug;
  }
  return `${base}-${randomSuffix(8)}`;
}
