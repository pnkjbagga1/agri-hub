import "dotenv/config";
import pg from "pg";
import { createHmac } from "node:crypto";
import zlib from "node:zlib";
const B = "http://localhost:3100";
const IP = "10.77." + Math.floor(Math.random() * 250) + "." + Math.floor(Math.random() * 250);
const PW = "AgriHub-Demo-2026";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const R = [];
const rec = (id, ok, info) => {
  R.push([id, ok ? "PASS" : "FAIL", info]);
  console.log(id, ok ? "PASS" : "FAIL", typeof info === "string" ? info : JSON.stringify(info));
};
const rnd = () => Math.random().toString(36).slice(2, 10);
async function req(method, path, { body, cookie, headers = {}, ip = IP, raw } = {}) {
  const h = { "x-real-ip": ip, ...headers };
  if (body !== undefined && !raw) h["content-type"] = "application/json";
  if (cookie) h.cookie = cookie;
  const res = await fetch(B + path, { method, headers: h, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined), redirect: "manual" });
  const sc = res.headers.getSetCookie?.() ?? [];
  const m = sc.map((s) => s.match(/^ah_session=([^;]*)/)).find(Boolean);
  let j = null;
  const t = await res.text();
  try { j = JSON.parse(t); } catch { j = t; }
  return { s: res.status, j, h: res.headers, sc, cookie: m ? (m[1] ? `ah_session=${m[1]}` : "") : null };
}
const outbox = async (to, subj) => (await db.query(`select * from "EmailOutbox" where "to"=$1 and subject like $2 order by "createdAt" desc limit 1`, [to, subj + "%"])).rows[0];
const tok = (row) => row?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
function b32(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of s.replace(/=+$/, "").toUpperCase()) { const v = A.indexOf(ch); if (v < 0) continue; bits += v.toString(2).padStart(5, "0"); }
  const o = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(o);
}
function totp(sec, t = Date.now()) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(Math.floor(t / 30000)));
  const h = createHmac("sha1", b32(sec)).update(b).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0");
}
async function signup(role, extra = {}) {
  const email = `qa-auth-${rnd()}@example.test`;
  const r = await req("POST", "/api/v1/auth/signup", { body: { role, orgName: "QA Org " + rnd(), contactName: "QA Tester", email, password: "Qa-Strong-Pass-" + rnd() + "9", acceptTerms: true, ...extra } });
  if (r.s !== 200) console.log("signup failed", r.s, r.j);
  return { email, r, cookie: r.cookie };
}
const login = (email, password, portal = "member", totpc, ip) => req("POST", "/api/v1/auth/login", { body: { email, password, portal, ...(totpc ? { totp: totpc } : {}) }, ip });

// 1
{
  const e = `qa-auth-${rnd()}@example.test`;
  const base = { role: "grower", orgName: "QA Org", contactName: "QA T", email: e, acceptTerms: true };
  const w = await req("POST", "/api/v1/auth/signup", { body: { ...base, password: "short1" } });
  rec("1a weak pw", w.s === 422 && (w.j.details?.password || w.j.fields?.password), [w.s, w.j]);
  const nt = await req("POST", "/api/v1/auth/signup", { body: { ...base, password: "Qa-Strong-Pass-77", acceptTerms: undefined } });
  rec("1b no acceptTerms", nt.s === 422 && nt.j.fields?.acceptTerms, [nt.s, nt.j]);
  const ad = await req("POST", "/api/v1/auth/signup", { body: { ...base, role: "admin", password: "Qa-Strong-Pass-77" } });
  rec("1c admin role", ad.s === 422 && ad.j.fields?.role, [ad.s, ad.j]);
  const ok = await req("POST", "/api/v1/auth/signup", { body: { ...base, password: "Qa-Strong-Pass-77" } });
  const dup = await req("POST", "/api/v1/auth/signup", { body: { ...base, password: "Qa-Strong-Pass-77" } });
  rec("1d duplicate", ok.s === 200 && dup.s === 409, [ok.s, dup.s, dup.j]);
  const dupCase = await req("POST", "/api/v1/auth/signup", { body: { ...base, email: e.toUpperCase(), password: "Qa-Strong-Pass-77" } });
  rec("1e duplicate (case)", dupCase.s === 409, [dupCase.s]);
}
// 2
const PWG = "Qa-Grower-Pass-2026x";
const G = await signup("grower", { password: PWG });
{
  const sc = G.r.sc.find((s) => s.startsWith("ah_session=")) || "";
  rec("2a cookie flags", G.r.s === 200 && /HttpOnly/i.test(sc) && /SameSite=Lax/i.test(sc), sc.replace(/=[^;]{20,}/, "=<jwt>"));
  const me = await req("GET", "/api/v1/auth/me", { cookie: G.cookie });
  rec("2b /me safe", me.j.user?.email === G.email && !("passwordHash" in me.j.user) && !("totpSecret" in me.j.user), Object.keys(me.j.user || {}).join(","));
}
// 3
{
  const a = await login(G.email, PWG, "partner");
  const b = await login(G.email, PWG, "admin");
  rec("3a grower->partner/admin 403", a.s === 403 && a.j.details?.href === "/login" && b.s === 403 && b.j.details?.href === "/login", [a.s, a.j, b.s]);
  const p1 = await login("partner@agrihub.test", PW, "member");
  const p2 = await login("partner@agrihub.test", PW, "partner");
  rec("3b partner portal", p1.s === 403 && p1.j.details?.href === "/partners/login" && p2.s === 200, [p1.s, p1.j, p2.s]);
  const a1 = await login("admin@agrihub.test", PW, "member");
  const a2 = await login("admin@agrihub.test", PW, "partner");
  const a3 = await login("admin@agrihub.test", PW, "admin");
  rec("3c admin portal", a1.s === 403 && a2.s === 403 && a1.j.details?.href === "/admin/login" && (a3.s === 200 || a3.j?.needTotp), [a1.s, a2.s, a3.s, a3.j?.needTotp]);
}
// 4
{
  const L = await signup("buyer", { password: "Qa-Lock-Pass-2026x" });
  const u = await login(`qa-auth-nobody-${rnd()}@example.test`, "whatever123", "member");
  const w = [];
  for (let i = 0; i < 5; i++) w.push(await login(L.email, "Wrong-Pass-" + i));
  rec("4a generic 401", u.s === 401 && w[0].s === 401 && u.j.error === w[0].j.error, [u.s, u.j.error, w[0].j.error]);
  const sixth = await login(L.email, "Qa-Lock-Pass-2026x");
  const mail = await outbox(L.email, "AGRI HUB account locked");
  rec("4b lockout 423 + email", w.map((x) => x.s).join() === "401,401,401,401,401" && sixth.s === 423 && !!mail, [w.map((x) => x.s), sixth.s, sixth.j.error, !!mail]);
}
// 5
{
  const m = await outbox(G.email, "Confirm your AGRI HUB email");
  const t = tok(m);
  const v1 = await req("POST", "/api/v1/auth/verify-email", { body: { token: t } });
  const v2 = await req("POST", "/api/v1/auth/verify-email", { body: { token: t } });
  const me = await req("GET", "/api/v1/auth/me", { cookie: G.cookie });
  rec("5 verify once", !!t && v1.s === 200 && v2.s === 400 && !!me.j.user?.emailVerifiedAt, [v1.s, v2.s, me.j.user?.emailVerifiedAt]);
}
// 6
{
  const F = await signup("buyer", { password: "Qa-Reset-Pass-2026x" });
  const f1 = await req("POST", "/api/v1/auth/forgot", { body: { email: F.email } });
  const f2 = await req("POST", "/api/v1/auth/forgot", { body: { email: `qa-auth-none-${rnd()}@example.test` } });
  rec("6a forgot always ok", f1.s === 200 && f2.s === 200 && JSON.stringify(f1.j) === JSON.stringify(f2.j), [f1.s, f1.j, f2.s, f2.j]);
  const t = tok(await outbox(F.email, "Reset your AGRI HUB password"));
  const r1 = await req("POST", "/api/v1/auth/reset", { body: { token: t, password: "Qa-New-Reset-2026y" } });
  const me = await req("GET", "/api/v1/auth/me", { cookie: F.cookie });
  const r2 = await req("POST", "/api/v1/auth/reset", { body: { token: t, password: "Qa-New-Reset-2026z" } });
  const lo = await login(F.email, "Qa-New-Reset-2026y");
  const lold = await login(F.email, "Qa-Reset-Pass-2026x");
  rec("6b reset works, revokes, single-use", r1.s === 200 && me.j.user === null && r2.s === 400 && lo.s === 200 && lold.s === 401, [r1.s, me.j.user, r2.s, lo.s, lold.s]);
  await req("POST", "/api/v1/auth/forgot", { body: { email: F.email } });
  const t2 = tok(await outbox(F.email, "Reset your AGRI HUB password"));
  const weak = await req("POST", "/api/v1/auth/reset", { body: { token: t2, password: "weak" } });
  const retry = await req("POST", "/api/v1/auth/reset", { body: { token: t2, password: "Qa-New-Reset-2026q" } });
  rec("6c weak pw on reset should not burn token", weak.s === 422 && retry.s === 200, [weak.s, retry.s, retry.j]);
}
// 7
{
  const P = "Qa-Change-Pass-2026x";
  const C = await signup("buyer", { password: P });
  const second = await login(C.email, P);
  const bad = await req("POST", "/api/v1/auth/change-password", { cookie: C.cookie, body: { current: "nope-wrong-123", password: "Qa-Change-New-2026y" } });
  const good = await req("POST", "/api/v1/auth/change-password", { cookie: C.cookie, body: { current: P, password: "Qa-Change-New-2026y" } });
  const meNew = await req("GET", "/api/v1/auth/me", { cookie: good.cookie });
  const meOther = await req("GET", "/api/v1/auth/me", { cookie: second.cookie });
  rec("7a change-password", bad.s === 401 && good.s === 200 && !!meNew.j.user && meOther.j.user === null, [bad.s, good.s, !!meNew.j.user, meOther.j.user]);
  const l2 = await login(C.email, "Qa-Change-New-2026y");
  const la = await req("POST", "/api/v1/auth/logout-all", { cookie: good.cookie });
  const m1 = await req("GET", "/api/v1/auth/me", { cookie: good.cookie });
  const m2 = await req("GET", "/api/v1/auth/me", { cookie: l2.cookie });
  rec("7b logout-all", la.s === 200 && m1.j.user === null && m2.j.user === null, [la.s, m1.j.user, m2.j.user]);
  const l3 = await login(C.email, "Qa-Change-New-2026y");
  await req("POST", "/api/v1/auth/logout", { cookie: l3.cookie });
  const m3 = await req("GET", "/api/v1/auth/me", { cookie: l3.cookie });
  rec("7c (info) JWT still valid after plain logout", true, !!m3.j.user);
}
// 8
{
  const P = "Qa-Totp-Pass-2026x";
  const T = await signup("buyer", { password: P });
  const s = await req("POST", "/api/v1/auth/totp-setup", { cookie: T.cookie, body: {} });
  const cur = totp(s.j.secret);
  const badEn = await req("POST", "/api/v1/auth/totp-enable", { cookie: T.cookie, body: { code: String((Number(cur) + 500000) % 1e6).padStart(6, "0") } });
  const en = await req("POST", "/api/v1/auth/totp-enable", { cookie: T.cookie, body: { code: totp(s.j.secret) } });
  const l1 = await login(T.email, P);
  const wrongCode = String((Number(totp(s.j.secret)) + 500000) % 1e6).padStart(6, "0");
  const l2 = await login(T.email, P, "member", wrongCode);
  const l3 = await login(T.email, P, "member", totp(s.j.secret));
  rec("8 TOTP", s.s === 200 && !!s.j.secret && badEn.s === 422 && en.s === 200 && l1.s === 200 && l1.j.needTotp === true && !l1.cookie && l2.s === 401 && l3.s === 200 && !!l3.cookie, [s.s, badEn.s, en.s, l1.j, !!l1.cookie, l2.s, l3.s]);
  const l4 = await login(T.email, P, "member", totp(s.j.secret));
  rec("8b (info) same TOTP code replay accepted", true, l4.s);
}
// 9
{
  const a = await req("POST", "/api/v1/auth/logout", { headers: { origin: "https://evil.example" }, body: {} });
  const b = await req("POST", "/api/v1/auth/logout", { headers: { "sec-fetch-site": "cross-site" }, body: {} });
  const c = await req("POST", "/api/v1/auth/logout", { headers: { origin: "null" }, body: {} });
  const d = await req("POST", "/api/v1/auth/logout", { headers: { "sec-fetch-site": "same-site" }, body: {} });
  rec("9 CSRF", a.s === 403 && b.s === 403 && c.s === 403 && d.s === 403, [a.s, b.s, c.s, d.s]);
}
// 10
{
  const r = await req("GET", "/");
  const csp = r.h.get("content-security-policy") || "";
  rec("10a headers", /'nonce-[^']+'/.test(csp) && csp.includes("'strict-dynamic'") && !!r.h.get("x-frame-options") && r.h.get("x-content-type-options") === "nosniff" && !!r.h.get("referrer-policy"), { s: r.s, csp: csp.slice(0, 110), xfo: r.h.get("x-frame-options"), xcto: r.h.get("x-content-type-options"), rp: r.h.get("referrer-policy") });
  const d = await req("GET", "/dashboard");
  const ad = await req("GET", "/admin");
  rec("10b redirects", d.s === 307 && /\/login\?next=%2Fdashboard/.test(d.h.get("location")) && ad.s === 307 && /\/admin\/login$/.test(ad.h.get("location")), [d.s, d.h.get("location"), ad.s, ad.h.get("location")]);
}
// 11
{
  const BU = await signup("buyer");
  const l = await req("POST", "/api/v1/listings", { cookie: BU.cookie, body: { title: "x" } });
  const m = await req("POST", "/api/v1/admin/moderate", { cookie: G.cookie, body: { type: "listing", id: "x", action: "approve" } });
  const lid = (await db.query(`select l.id from "Listing" l join "User" u on u.id=l."growerId" where u.email='grower@agrihub.test' limit 1`)).rows[0].id;
  const p = await req("PATCH", `/api/v1/listings/${lid}`, { cookie: G.cookie, body: { status: "paused" } });
  const del = await req("DELETE", `/api/v1/listings/${lid}`, { cookie: G.cookie });
  rec("11 authz", l.s === 403 && m.s === 403 && [403, 404].includes(p.s) && [403, 404].includes(del.s), [l.s, m.s, p.s, del.s]);
}
// 12
{
  const none = await req("POST", "/api/v1/uploads/sign", { body: { kind: "avatar", contentType: "image/png", size: 100 } });
  const bad = await req("POST", "/api/v1/uploads/sign", { cookie: G.cookie, body: { kind: "avatar", contentType: "text/html", size: 100 } });
  const svg = await req("POST", "/api/v1/uploads/sign", { cookie: G.cookie, body: { kind: "avatar", contentType: "image/svg+xml", size: 100 } });
  const big = await req("POST", "/api/v1/uploads/sign", { cookie: G.cookie, body: { kind: "avatar", contentType: "image/png", size: 9 * 1024 * 1024 } });
  rec("12a sign validation", none.s === 401 && bad.s === 415 && svg.s === 415 && big.s === 413, [none.s, bad.s, svg.s, big.s]);
  const crcT = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (buf) => { let x = 0xffffffff; for (const b of buf) x = crcT[(x ^ b) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cc]); };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.from([0, 255, 0, 0]))), chunk("IEND", Buffer.alloc(0))]);
  const s = await req("POST", "/api/v1/uploads/sign", { cookie: G.cookie, body: { kind: "avatar", contentType: "image/png", size: png.length } });
  const put = await req("PUT", s.j.uploadUrl, { headers: { "content-type": "image/png" }, raw: png });
  const get = await fetch(B + s.j.publicUrl);
  rec("12b valid upload+serve", s.s === 200 && put.s === 200 && get.status === 200 && get.headers.get("content-type") === "image/png" && get.headers.get("x-content-type-options") === "nosniff", [s.s, put.s, put.j, get.status, get.headers.get("content-type"), get.headers.get("x-content-type-options")]);
  const s2 = await req("POST", "/api/v1/uploads/sign", { cookie: G.cookie, body: { kind: "avatar", contentType: "image/png", size: 40 } });
  const txt = await req("PUT", s2.j.uploadUrl, { headers: { "content-type": "image/png" }, raw: Buffer.from("<script>alert(1)</script> hello") });
  rec("12c text as png 415", txt.s === 415, [txt.s, txt.j]);
  const t = s2.j.uploadUrl.split("token=")[1];
  const [b64, sig] = t.split(".");
  const forged = Buffer.from(Buffer.from(b64, "base64url").toString().replace("avatar/", "listing/")).toString("base64url") + "." + sig;
  const tamp = await req("PUT", `/api/v1/uploads/local?token=${forged}`, { headers: { "content-type": "image/png" }, raw: png });
  const tamp2 = await req("PUT", `/api/v1/uploads/local?token=${b64}.${sig.slice(0, -2)}AA`, { headers: { "content-type": "image/png" }, raw: png });
  rec("12d tampered token 403", tamp.s === 403 && tamp2.s === 403, [tamp.s, tamp2.s]);
  const tr = [];
  for (const p of ["/media/../../.env", "/media/..%2F..%2F.env", "/media/%2e%2e/%2e%2e/.env", "/media/avatar/2026/11/..%2F..%2F..%2F..%2F.env"]) {
    const r = await fetch(B + p, { redirect: "manual" });
    tr.push([p, r.status, (await r.text()).includes("DATABASE_URL")]);
  }
  rec("12e traversal", tr.every(([, st, leak]) => !leak && st !== 200), tr);
  const replay = await req("PUT", s.j.uploadUrl, { headers: { "content-type": "image/png" }, raw: png });
  rec("12f (info) signed URL replayable (overwrite)", true, replay.s);
}
// 13
{
  const e = `qa-auth-rl-${rnd()}@example.test`;
  const rlip = "10.99." + Math.floor(Math.random() * 250) + ".1";
  let hit = null, n = 0;
  for (n = 1; n <= 70; n++) { const r = await login(e, "x", "member", undefined, rlip); if (r.s === 429) { hit = r; break; } }
  rec("13 rate limit 429+Retry-After", !!hit && !!hit.h.get("retry-after"), [n, hit?.s, hit?.h.get("retry-after"), hit?.j]);
  const spoof = await login(e, "x", "member", undefined, "10.99.251.251");
  rec("13b (risk) X-Real-IP spoof resets per-IP limit", true, spoof.s);
}
// 14
{
  const X = await signup("grower", { orgName: `<img src=x onerror=alert(1)>QA`, city: `"><script>alert(2)</script>` });
  const me = await req("GET", "/api/v1/auth/me", { cookie: X.cookie });
  const slug = me.j.user?.profile?.slug;
  const pages = [];
  for (const p of [`/directory/${slug}`, `/profiles/${slug}`, `/p/${slug}`, `/members/${slug}`, `/dashboard`, `/settings`, `/settings/profile`]) {
    const r = await req("GET", p, { cookie: X.cookie });
    pages.push([p, r.s, String(r.j).includes("<img src=x onerror") || String(r.j).includes("<script>alert(2)")]);
  }
  rec("14a XSS stored in profile", pages.some(([, s]) => s === 200) && pages.every(([, , v]) => !v), { slug, pages });
  const thr = (await db.query(`select id from "Thread" limit 1`)).rows[0]?.id;
  const g1 = await req("GET", `/api/v1/threads/${thr}/messages`, { cookie: G.cookie });
  const p1 = await req("POST", `/api/v1/threads/${thr}/messages`, { cookie: G.cookie, body: { body: "qa idor" } });
  rec("14b thread IDOR 404", g1.s === 404 && [403, 404].includes(p1.s), [g1.s, p1.s, p1.j]);
  rec("14c open redirect next=/\\evil.example resolves to", true, new URL("/\\evil.example", B).href);
}
await db.end();
console.log("\nSUMMARY");
for (const [id, s] of R) console.log(s, id);
