import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import type { RoleKey } from "@/lib/constants";
import { getSessionUser, type SessionUser } from "./session";
import { clientIp, rateLimit } from "./security";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const fail = (status: number, message: string, details?: unknown): never => {
  throw new ApiError(status, message, details);
};

type Ctx<P> = { req: NextRequest; params: P; user: SessionUser | null; ip: string };
type AuthedCtx<P> = Ctx<P> & { user: SessionUser };

type Options = {
  /** require a signed-in user; pass roles to restrict further */
  auth?: boolean | RoleKey[];
  /** [limit, windowSeconds] per IP (+ user when signed in) */
  rateLimit?: [number, number];
  /** a stable name for the rate-limit bucket */
  name?: string;
};

type RouteCtx = { params: Promise<Record<string, string | string[]>> };

/**
 * Wraps a route handler with: authentication/authorisation, per-route rate
 * limiting, uniform JSON errors and Zod validation errors mapped to 422.
 */
export function handler<P = Record<string, string>>(
  opts: Options & { auth: true | RoleKey[] },
  fn: (ctx: AuthedCtx<P>) => Promise<unknown>,
): (req: NextRequest, rc: RouteCtx) => Promise<Response>;
export function handler<P = Record<string, string>>(opts: Options, fn: (ctx: Ctx<P>) => Promise<unknown>): (req: NextRequest, rc: RouteCtx) => Promise<Response>;
export function handler<P>(opts: Options, fn: ((ctx: Ctx<P>) => Promise<unknown>) | ((ctx: AuthedCtx<P>) => Promise<unknown>)) {
  return async (req: NextRequest, rc: RouteCtx) => {
    try {
      const ip = clientIp(req.headers);
      const user = await getSessionUser();
      if (opts.auth) {
        if (!user) fail(401, "Please sign in to continue.");
        if (Array.isArray(opts.auth) && !opts.auth.includes(user!.role as RoleKey)) fail(403, "You don't have access to this action.");
      }
      if (opts.rateLimit) {
        const [limit, win] = opts.rateLimit;
        const key = `${opts.name ?? req.nextUrl.pathname}:${user?.id ?? ip}`;
        const r = rateLimit(key, limit, win * 1000);
        if (!r.ok) {
          return NextResponse.json({ error: "Too many requests. Please slow down and try again shortly." }, { status: 429, headers: { "Retry-After": String(r.retryAfter) } });
        }
      }
      const params = (await rc.params) as P;
      // when opts.auth is set, user is guaranteed non-null above
      const result = await (fn as (ctx: Ctx<P>) => Promise<unknown>)({ req, params, user, ip });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const retry = err.status === 429 ? String((err.details as { retryAfter?: number } | undefined)?.retryAfter ?? 60) : null;
        return NextResponse.json({ error: err.message, details: err.details }, { status: err.status, headers: retry ? { "Retry-After": retry } : undefined });
      }
      if (err instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of err.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
        return NextResponse.json({ error: "Please check the highlighted fields.", fields }, { status: 422 });
      }
      console.error("[api]", req.method, req.nextUrl.pathname, err);
      return NextResponse.json({ error: "Something went wrong on our side." }, { status: 500 });
    }
  };
}

export async function body<T extends ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    fail(400, "Invalid JSON body.");
  }
  return schema.parse(json);
}

/* ---------------- shared zod helpers ---------------- */
export const zText = (max = 200) => z.string().trim().max(max);
export const zReqText = (max = 200, min = 1) => z.string().trim().min(min, "Required").max(max);
export const zOptText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
export const zUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null))
  .refine((v) => v === null || /^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(v), "Enter a valid URL");
export const zDate = z
  .union([z.string().max(40), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Invalid date")
  .optional()
  .transform((v) => v ?? null);
/** media URLs must come from our own storage, never arbitrary hosts */
const MEDIA_RE = /^\/(media\/[a-z]+\/\d{4}\/\d{2}\/[a-z0-9-]+\.(?:jpg|png|webp|avif)|seed\/(?:[a-z0-9-]+\.svg|photos\/[a-z0-9-]+\.jpg))$/;
export const zMedia = z
  .string()
  .max(600)
  .refine((u) => MEDIA_RE.test(u) || (!!process.env.S3_PUBLIC_BASE_URL && u.startsWith(process.env.S3_PUBLIC_BASE_URL + "/") && !u.includes("..")), "Upload images through AGRI HUB");

/** storage key from a media URL we issued (null for seed art) */
export function mediaKey(url: string) {
  if (url.startsWith("/media/")) return url.slice(7);
  const base = process.env.S3_PUBLIC_BASE_URL;
  if (base && url.startsWith(base + "/")) return url.slice(base.length + 1);
  return null;
}
