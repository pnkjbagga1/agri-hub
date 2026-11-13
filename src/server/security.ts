import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/* ---------------- Passwords (Argon2id, OWASP-recommended parameters) ---------------- */

const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export function hashPassword(password: string) {
  return hash(password, ARGON_OPTS);
}

export async function verifyPassword(hashed: string, password: string) {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

const COMMON = new Set(["password", "password1", "password123", "12345678", "123456789", "1234567890", "qwerty123", "letmein", "welcome1", "iloveyou", "admin123", "farmer123", "agrihub123"]);

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(pw: string, email?: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 128) return "Password is too long.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Use a mix of letters and numbers.";
  if (COMMON.has(pw.toLowerCase())) return "That password is too common.";
  if (email && pw.toLowerCase().includes(email.split("@")[0]!.toLowerCase())) return "Don't include your email in the password.";
  return null;
}

/* ---------------- Opaque tokens (email verification, password reset) ---------------- */

export function newToken() {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: sha256(raw) };
}

export function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/* ---------------- TOTP (RFC 6238) for admin two-factor ---------------- */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newTotpSecret() {
  const bytes = randomBytes(20);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(s: string) {
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const v = B32.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(buf).digest();
  const offset = h[h.length - 1]! & 0xf;
  const code = ((h.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
  return code;
}

export function totpNow(secret: string, at = Date.now()) {
  return hotp(base32Decode(secret), Math.floor(at / 30000));
}

/**
 * Accepts the current code and one step either side for clock drift.
 * Returns the matched time-step (or null). Callers reject steps <= the last used one,
 * so each code works only once.
 */
export function verifyTotp(secret: string, code: string, lastStep?: number | null): number | null {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const key = base32Decode(secret);
  const step = Math.floor(Date.now() / 30000);
  for (const d of [-1, 0, 1]) {
    const s = step + d;
    if (lastStep != null && s <= lastStep) continue;
    if (safeEqual(hotp(key, s), clean)) return s;
  }
  return null;
}

export function totpUri(secret: string, email: string) {
  const label = encodeURIComponent(`AGRI HUB:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("AGRI HUB")}&algorithm=SHA1&digits=6&period=30`;
}

/* ---------------- Rate limiting ---------------- */
// Fixed-window counter held in memory. Good for a single instance; swap the
// store for Redis/Upstash when running more than one server.

type Bucket = { count: number; resetAt: number };
const buckets = (globalThis as unknown as { __rl?: Map<string, Bucket> }).__rl ?? new Map<string, Bucket>();
(globalThis as unknown as { __rl?: Map<string, Bucket> }).__rl = buckets;

const SCALE = Math.max(1, Number(process.env.RATE_LIMIT_SCALE ?? 1) || 1); // raise only for local load/QA testing

export function rateLimit(key: string, baseLimit: number, windowMs: number) {
  const limit = baseLimit * SCALE;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  b.count += 1;
  if (buckets.size > 50_000) for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), retryAfter: Math.ceil((b.resetAt - now) / 1000) };
}

/**
 * Client IP for rate limiting. Proxy headers are only trusted when TRUST_PROXY names the one
 * our own infrastructure sets; otherwise callers could rotate them to dodge limits.
 *   TRUST_PROXY=vercel     -> x-vercel-forwarded-for / x-forwarded-for (set by Vercel's edge)
 *   TRUST_PROXY=x-real-ip  -> x-real-ip (nginx / Cloudflare style)
 *   TRUST_PROXY=xff-last   -> right-most X-Forwarded-For entry (single reverse proxy)
 *   unset                  -> no headers trusted
 */
export function clientIp(headers: Headers) {
  const mode = process.env.TRUST_PROXY;
  if (mode === "vercel") return (headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || "unknown";
  if (mode === "x-real-ip") return headers.get("x-real-ip")?.trim() || "unknown";
  if (mode === "xff-last") return headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean).at(-1) || "unknown";
  return "direct";
}
