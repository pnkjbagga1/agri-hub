import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ah_session";
const MEMBER_AREAS = ["/dashboard", "/messages", "/notifications", "/settings", "/onboarding"];
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function originAllowed(req: NextRequest) {
  // Cross-site request forgery guard for every state-changing API call.
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return site === "same-origin" || site === "none" || !site; // non-browser clients (tests, mobile) send no Origin
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

function csp(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  const s3 = [process.env.S3_PUBLIC_BASE_URL, process.env.S3_ENDPOINT].filter(Boolean).map((u) => new URL(u!).origin).join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // React renders style attributes server-side; inline styles can't execute code.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: https://*.tile.openstreetmap.org ${s3}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${s3}${dev ? " ws: wss:" : ""}`.trim(),
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (UNSAFE.has(req.method) && !originAllowed(req)) {
      return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
    }
    return NextResponse.next();
  }

  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (!hasSession && MEMBER_AREAS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const url = req.nextUrl.clone(); // clone keeps the basePath (e.g. /hub)
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (!hasSession && pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", policy);
  if (process.env.NODE_ENV === "production") res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return res;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|brand/|seed/|media/|sw.js|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
