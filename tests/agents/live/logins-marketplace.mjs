// Live test: every sign-in path and the whole marketplace, against a deployed AGRI HUB.
// Uses the seeded demo accounts and removes everything it creates.
// Usage: QA_BASE=https://… QA_PASSWORD=… DATABASE_URL=… node tests/agents/live/logins-marketplace.mjs
import pg from "pg";

const BASE = process.env.QA_BASE;
const PW = process.env.QA_PASSWORD;
if (!BASE || !PW || !process.env.DATABASE_URL) throw new Error("QA_BASE, QA_PASSWORD and DATABASE_URL are required");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;
const rnd = Math.random().toString(36).slice(2, 7);

const results = [];
const check = (id, ok, note = "") => {
  results.push({ id, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}${ok ? "" : `  -- ${String(typeof note === "string" ? note : JSON.stringify(note)).slice(0, 300)}`}`);
};

class Agent {
  constructor(label) {
    this.label = label;
    this.jar = {};
    this.lastCookies = [];
  }
  async req(method, path, body, extra = {}) {
    const headers = { cookie: Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; "), origin: BASE, "sec-fetch-site": "same-origin", ...extra };
    let payload;
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const r = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
    this.lastCookies = r.headers.getSetCookie?.() ?? [];
    for (const c of this.lastCookies) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      const v = kv.slice(i + 1);
      if (v) this.jar[kv.slice(0, i)] = v;
      else delete this.jar[kv.slice(0, i)];
    }
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: r.status, json, text, location: r.headers.get("location") };
  }
  login(email, portal, password = PW) {
    return this.req("POST", "/api/v1/auth/login", { email, password, portal });
  }
}

let created = null;
try {
  /* ======================= LOGINS ======================= */
  for (const [p, must] of [["/login", 'name="password"'], ["/partners/login", 'name="password"'], ["/admin/login", 'name="password"'], ["/forgot-password", 'name="email"'], ["/signup", "Grower"]]) {
    const r = await new Agent("v").req("GET", p);
    check(`login page ${p} loads with its form`, r.status === 200 && r.text.includes(must), r.status);
  }

  const accounts = [
    ["grower@agrihub.test", "member", "grower", "/dashboard"],
    ["buyer@agrihub.test", "member", "buyer", "/dashboard"],
    ["partner@agrihub.test", "partner", "consultant", "/dashboard"],
    ["agtech@agrihub.test", "partner", "agtech", "/dashboard"],
    ["admin@agrihub.test", "admin", "admin", "/admin"],
  ];
  const agents = {};
  for (const [email, portal, role, home] of accounts) {
    const a = new Agent(role);
    const r = await a.login(email, portal);
    const cookie = a.lastCookies.find((c) => /httponly/i.test(c)) ?? a.lastCookies[0] ?? "";
    check(`${role}: signs in to the ${portal} portal`, r.status === 200 && r.json?.ok, `${r.status} ${r.text.slice(0, 120)}`);
    check(`${role}: session cookie is HttpOnly, Secure and SameSite`, /httponly/i.test(cookie) && /secure/i.test(cookie) && /samesite=(lax|strict)/i.test(cookie), cookie.replace(/=[^;]+/, "=…").slice(0, 120));
    const me = await a.req("GET", "/api/v1/auth/me");
    check(`${role}: /me shows the right account and role`, me.json?.user?.email === email && me.json?.user?.role === role, JSON.stringify(me.json?.user ?? null).slice(0, 120));
    check(`${role}: login response never leaks the password hash`, !/passwordHash|totpSecret|\$argon2/.test(me.text + r.text), "leak");
    const d = await a.req("GET", home);
    check(`${role}: ${home} opens after sign-in`, d.status === 200, d.status);
    agents[role] = a;
  }

  // wrong credentials and account enumeration
  const wrong = await new Agent("x").login("grower@agrihub.test", "member", "Wrong-Password-123");
  const nobody = await new Agent("x").login(`nobody-${rnd}@example.test`, "member", "Wrong-Password-123");
  check("wrong password is rejected (401)", wrong.status === 401, wrong.status);
  check("unknown email is rejected the same way (no account enumeration)", nobody.status === 401 && nobody.json?.error === wrong.json?.error, [nobody.status, nobody.json?.error, wrong.json?.error]);
  const empty = await new Agent("x").req("POST", "/api/v1/auth/login", { email: "", password: "", portal: "member" });
  check("empty sign-in form is rejected", empty.status === 401 || empty.status === 422, empty.status);

  // portal separation
  for (const [email, portal, label] of [
    ["grower@agrihub.test", "partner", "grower → partner portal"],
    ["grower@agrihub.test", "admin", "grower → admin portal"],
    ["partner@agrihub.test", "member", "partner → member portal"],
    ["buyer@agrihub.test", "admin", "buyer → admin portal"],
  ]) {
    const r = await new Agent("x").login(email, portal);
    check(`portal separation: ${label} is refused`, r.status !== 200, r.status);
  }
  for (const [role, path] of [["grower", "/admin"], ["buyer", "/admin/users"], ["partner", "/admin"]]) {
    const r = await agents[role === "partner" ? "consultant" : role].req("GET", path);
    check(`${role} cannot open ${path}`, r.status !== 200, r.status);
  }
  const anon = await new Agent("x").req("GET", "/api/v1/auth/me");
  check("signed-out visitor has no session", anon.json?.user == null, JSON.stringify(anon.json).slice(0, 80));
  const csrf = await new Agent("x").req("POST", "/api/v1/auth/login", { email: "grower@agrihub.test", password: PW, portal: "member" }, { origin: "https://evil.example", "sec-fetch-site": "cross-site" });
  check("sign-in from another website is blocked (CSRF)", csrf.status === 403, csrf.status);
  const fp = await new Agent("x").req("POST", "/api/v1/auth/forgot", { email: `nobody-${rnd}@example.test` });
  check("forgot-password gives the same answer for unknown emails", fp.status === 200, fp.status);

  // sign-out really ends the session
  const temp = new Agent("temp");
  await temp.login("buyer@agrihub.test", "member");
  const before = await temp.req("GET", "/api/v1/auth/me");
  const stolen = { ...temp.jar };
  await temp.req("POST", "/api/v1/auth/logout");
  const after = new Agent("replay");
  after.jar = stolen;
  const replay = await after.req("GET", "/api/v1/auth/me");
  check("sign-out ends the session, even if the old cookie is replayed", before.json?.user?.email === "buyer@agrihub.test" && replay.json?.user == null, [before.json?.user?.email, replay.json?.user?.email]);

  /* ===================== MARKETPLACE ===================== */
  const v = new Agent("visitor");
  const all = await v.req("GET", "/api/v1/listings");
  check("marketplace lists active listings", all.status === 200 && all.json?.total > 0 && all.json.items.length > 0, `${all.status} total=${all.json?.total}`);
  const page = await v.req("GET", "/marketplace");
  check("marketplace page shows listing cards", page.status === 200 && (page.text.match(/href="\/marketplace\/[a-z0-9-]+"/g) ?? []).length >= 4, page.status);

  const s = await v.req("GET", "/api/v1/listings?q=blueberr");
  check("search 'blueberr' finds only blueberry listings", s.json?.total > 0 && s.json.items.every((i) => /blueberr/i.test(i.title + i.produce)), s.json?.items?.map((i) => i.title).slice(0, 3));
  const none = await v.req("GET", `/api/v1/listings?q=zzqx${rnd}`);
  check("search with no match returns zero, not an error", none.status === 200 && none.json?.total === 0, none.status);
  const cats = [...new Set(all.json.items.map((i) => i.category))];
  const c1 = await v.req("GET", `/api/v1/listings?category=${cats[0]}`);
  check(`category filter (${cats[0]}) returns only that category`, c1.json?.total > 0 && c1.json.items.every((i) => i.category === cats[0]), c1.json?.items?.map((i) => i.category));
  const [region] = await q(`select r.slug from "Region" r join "Listing" l on l."regionId"=r.id where l.status='active' group by r.slug order by count(*) desc limit 1`);
  const rf = await v.req("GET", `/api/v1/listings?region=${region.slug}`);
  check(`region filter (${region.slug}) returns listings`, rf.status === 200 && rf.json?.total > 0, rf.json?.total);
  const asc = await v.req("GET", "/api/v1/listings?sort=price_asc");
  // "price on request" listings have no price and sort last
  const ps = asc.json?.items?.filter((i) => i.price != null).map((i) => Number(i.price)) ?? [];
  check("sort by price (low → high) is in order", ps.length > 1 && ps.every((p, i) => i === 0 || p >= ps[i - 1]), ps.slice(0, 6));
  const desc = await v.req("GET", "/api/v1/listings?sort=price_desc");
  const pd = desc.json?.items?.filter((i) => i.price != null).map((i) => Number(i.price)) ?? [];
  check("sort by price (high → low) is in order", pd.length > 1 && pd.every((p, i) => i === 0 || p <= pd[i - 1]), pd.slice(0, 6));
  const map = await v.req("GET", "/marketplace?view=map");
  check("map view loads", map.status === 200, map.status);
  for (const p of ["/marketplace?q=tomato", "/marketplace?sort=harvest", "/marketplace?page=2", "/marketplace?category=does-not-exist"]) {
    const r = await v.req("GET", p);
    check(`marketplace URL ${p} loads safely`, r.status === 200, r.status);
  }

  // every active listing page works
  const slugs = await q(`select slug, "lotCode" from "Listing" where status='active' and approval='approved'`);
  let okPages = 0;
  const broken = [];
  for (const l of slugs) {
    const r = await v.req("GET", `/marketplace/${l.slug}`);
    if (r.status === 200 && r.text.includes("/directory/")) okPages++;
    else broken.push(`${l.slug}:${r.status}`);
  }
  check(`all ${slugs.length} listing pages open with their grower`, okPages === slugs.length, broken.slice(0, 5));
  const lot = slugs.find((l) => l.lotCode);
  if (lot) {
    const t = await v.req("GET", `/trace/${lot.lotCode}`);
    check("lot traceability page opens", t.status === 200, t.status);
  }
  const missing = await v.req("GET", `/marketplace/no-such-listing-${rnd}`);
  check("missing listing shows a 404, not a crash", missing.status === 404, missing.status);

  // full listing lifecycle: grower publishes → admin approves → buyer finds, saves and enquires → grower edits and removes
  const grower = agents.grower;
  const buyer = agents.buyer;
  const admin = agents.admin;
  const [fv] = await q(`select id from "Region" where slug='fraser-valley'`);
  const title = `Live QA ${rnd} Duke blueberries`;
  const listingBody = {
    title, produce: "Blueberries", category: "berries", description: "Live QA listing, removed automatically.", volume: 500, unit: "kg", price: 4.6, priceUnit: "kg", pricingMethod: "fixed",
    harvestStart: new Date(Date.now() + 5 * 864e5).toISOString(), harvestEnd: new Date(Date.now() + 40 * 864e5).toISOString(), status: "active", photos: ["/seed/photos/art-1.jpg"], regionId: fv.id, deliveryOptions: ["pickup"],
  };
  const cr = await grower.req("POST", "/api/v1/listings", listingBody);
  check("grower: publishes a new listing", cr.status === 200 && cr.json?.id, `${cr.status} ${cr.text.slice(0, 200)}`);
  created = cr.json?.id ?? null;
  if (created) {
    if (cr.json?.approval === "pending") {
      // "post" moderation: listings go live straight away and admins review after; "pre": hidden until approved
      const preview = await v.req("GET", `/api/v1/listings?q=${encodeURIComponent(`Live QA ${rnd}`)}`);
      const expected = cr.json?.moderation === "pre" ? 0 : 1;
      check(`moderation (${cr.json?.moderation ?? "?"}): listing visibility before review is correct`, preview.json?.total === expected, [cr.json?.moderation, preview.json?.total]);
      const ap = await admin.req("POST", "/api/v1/admin/moderate", { type: "listing", id: created, action: "approve" });
      check("admin: approves the listing", ap.status === 200, ap.status);
    }
    const found = await v.req("GET", `/api/v1/listings?q=${encodeURIComponent(`Live QA ${rnd}`)}`);
    const item = found.json?.items?.[0];
    check("new listing appears in marketplace search", found.json?.total === 1 && item?.title === title, found.json?.total);
    const detail = item ? await v.req("GET", item.url) : { status: 0, text: "" };
    check("new listing page opens", detail.status === 200 && detail.text.includes("Duke blueberries"), detail.status);
    const fav = await buyer.req("POST", `/api/v1/favorites/${created}`);
    const saved = await buyer.req("GET", "/dashboard/saved");
    check("buyer: saves the listing to favourites", fav.status === 200 && saved.status === 200 && saved.text.includes("Duke blueberries"), [fav.status, saved.status]);
    const unfav = await buyer.req("DELETE", `/api/v1/favorites/${created}`);
    check("buyer: removes it from favourites", unfav.status === 200, unfav.status);
    const t = await buyer.req("POST", "/api/v1/threads", { recipientId: (await q(`select "growerId" from "Listing" where id=$1`, [created]))[0].growerId, listingId: created, body: `Live QA ${rnd}: is this available for pickup next week?` });
    check("buyer: sends an inquiry about the new listing", t.status === 200 && t.json?.threadId, t.status);
    if (t.json?.threadId) await q(`delete from "Thread" where id=$1`, [t.json.threadId]);
    const hijack = await buyer.req("PATCH", `/api/v1/listings/${created}`, { ...listingBody, price: 0.01 });
    check("buyer cannot edit someone else's listing", hijack.status === 403 || hijack.status === 404, hijack.status);
    const ed = await grower.req("PATCH", `/api/v1/listings/${created}`, { ...listingBody, price: 4.9 });
    const after = await v.req("GET", `/api/v1/listings?q=${encodeURIComponent(`Live QA ${rnd}`)}`);
    check("grower: edits the price and the marketplace updates", ed.status === 200 && Number(after.json?.items?.[0]?.price) === 4.9, [ed.status, after.json?.items?.[0]?.price]);
    const del = await grower.req("DELETE", `/api/v1/listings/${created}`);
    const gone = await v.req("GET", `/api/v1/listings?q=${encodeURIComponent(`Live QA ${rnd}`)}`);
    check("grower: removes the listing and it leaves the marketplace", del.status === 200 && gone.json?.total === 0, [del.status, gone.json?.total]);
  }
  const anonCreate = await new Agent("x").req("POST", "/api/v1/listings", { title: "x" });
  check("signed-out visitor cannot create listings", anonCreate.status === 401, anonCreate.status);
  const buyerCreate = await buyer.req("POST", "/api/v1/listings", { title: "x" });
  check("buyer cannot create produce listings", buyerCreate.status === 403, buyerCreate.status);

  for (const a of Object.values(agents)) await a.req("POST", "/api/v1/auth/logout");
} finally {
  if (created) await q(`delete from "Listing" where id=$1`, [created]).catch(() => {});
  const left = await q(`select count(*)::int n from "Listing" where title like $1`, [`Live QA ${rnd}%`]);
  console.log(`\ncleanup: leftover QA listings=${left[0].n}`);
  await db.end();
  const pass = results.filter((r) => r.ok).length;
  console.log(`\nLOGINS + MARKETPLACE: ${pass}/${results.length} passed`);
}
