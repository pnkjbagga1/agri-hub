// QA: directory, partner programs, events, community, admin moderation/users/KPIs/regions/audit.
// Run from project root: node tests/agents/admin/qa-admin.mjs
import "dotenv/config";
import pg from "pg";

const BASE = "http://localhost:3100";
const PW = "AgriHub-Demo-2026";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const rnd = Math.random().toString(36).slice(2, 8);
const results = [];
const check = (name, ok, info = "") => {
  results.push({ name, ok: !!ok, info });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -- " + info : ""}`);
};

async function req(method, path, { cookie, json, redirect = "manual" } = {}) {
  const headers = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  const r = await fetch(BASE + path, { method, headers, body: json !== undefined ? JSON.stringify(json) : undefined, redirect });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body, headers: r.headers, text };
}
const cookieOf = (r) => {
  const sc = r.headers.getSetCookie?.() ?? [];
  const c = sc.find((s) => s.startsWith("ah_session="));
  return c ? c.split(";")[0] : null;
};
async function login(email, portal, password = PW) {
  const r = await req("POST", "/api/v1/auth/login", { json: { email, password, portal } });
  return { r, cookie: cookieOf(r) };
}
async function signup(role, extra = {}) {
  const email = `qa-admin-${rnd}-${role}-${Math.random().toString(36).slice(2, 6)}@example.test`;
  const password = `Qa${rnd}Pass9876x`;
  const r = await req("POST", "/api/v1/auth/signup", { json: { role, orgName: `QA ${role} ${rnd}`, contactName: "QA Tester", email, password, acceptTerms: true, ...extra } });
  const cookie = cookieOf(r);
  if (r.status !== 200) throw new Error(`signup ${role} ${r.status} ${JSON.stringify(r.body)}`);
  const [u] = await q(`select id from "User" where email=$1`, [email]);
  // test-user setup only: onboarding requires a photo before acting
  await q(`update "Profile" set "photoUrl"='/seed/placeholder.svg' where "userId"=$1`, [u.id]);
  return { email, password, cookie, id: u.id };
}

const admin = await login("admin@agrihub.test", "admin");
const grower = await login("grower@agrihub.test", "member");
const buyer = await login("buyer@agrihub.test", "member");
const partner = await login("partner@agrihub.test", "partner");
const agtech = await login("agtech@agrihub.test", "partner");
for (const [n, x] of Object.entries({ admin, grower, buyer, partner, agtech })) if (!x.cookie) throw new Error(`login ${n} failed ${x.r.status} ${JSON.stringify(x.r.body)}`);
const A = admin.cookie, G = grower.cookie, B = buyer.cookie, P = partner.cookie, T = agtech.cookie;
const [adminRow] = await q(`select id from "User" where email='admin@agrihub.test'`);
const startedAt = new Date();

/* ---------------- 1. Directory ---------------- */
{
  const tabs = ["", "farmers", "buyers", "processors", "universities", "consultants", "edc-fcc", "government", "agtech", "financing", "marketing", "suppliers", "dealers"];
  const roleMap = { farmers: ["grower"], buyers: ["buyer"], universities: ["university"], consultants: ["consultant"], "edc-fcc": ["edc", "fcc"], government: ["bc_gov", "fed_gov"], agtech: ["agtech"], financing: ["financing"], marketing: ["sales_marketing"], suppliers: ["supplier"], dealers: ["dealer"] };
  const bad = [], countIssues = [];
  for (const t of tabs) {
    const r = await req("GET", `/directory${t ? `?tab=${t}` : ""}`);
    if (r.status !== 200) bad.push(`${t || "all"}:${r.status}`);
    if (t && roleMap[t]) {
      const [{ n }] = await q(`select count(*)::int n from "Profile" p join "User" u on u.id=p."userId" where u.status='active' and p."photoUrl" is not null and p.approval<>'rejected' and u.role::text = any($1)`, [roleMap[t]]);
      const m = r.text.match(new RegExp(`tab=${t}"[^>]*>[^<]*<!-- -->\\s*<span[^>]*>(\\d+)<`)) || r.text.match(new RegExp(`tab=${t}[^>]*>[^<]*<span[^>]*>(\\d+)<`));
      const label = m ? Number(m[1]) : null;
      if (label !== n) countIssues.push(`${t}: label=${label} db=${n}`);
    }
  }
  check("1a /directory + 12 tabs return 200", bad.length === 0, bad.join(","));
  check("1b tab label counts match DB (visible profiles)", countIssues.length === 0, countIssues.join("; "));
  const s = await req("GET", "/directory?q=Sumas");
  check("1c ?q=Sumas finds Sumas Prairie Berry", s.status === 200 && s.text.includes("Sumas Prairie"));
  const s2 = await req("GET", "/directory?q=zzqqnotreal");
  check("1d ?q= no-match shows empty state", s2.text.includes("No organisations found"));
  const [reg] = await q(`select r.slug, count(p.id)::int n from "Region" r join "Profile" p on p."regionId"=r.id where p."photoUrl" is not null group by r.slug order by n desc limit 1`);
  const [other] = await q(`select p."orgName" from "Profile" p join "User" u on u.id=p."userId" left join "Region" r on r.id=p."regionId" where p."photoUrl" is not null and u.status='active' and u.role<>'admin' and (r.slug is null or r.slug<>$1) limit 1`, [reg.slug]);
  const rr = await req("GET", `/directory?region=${reg.slug}`);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
  check("1e ?region= filter excludes other regions", rr.status === 200 && !rr.text.includes(`>${esc(other.orgName)}<`), `region=${reg.slug} excluded "${other.orgName}"`);
  const fcc = await req("GET", "/directory/farm-credit-canada");
  check("1f unclaimed profile shows Unclaimed notice", fcc.status === 200 && /Unclaimed profile/.test(fcc.text) && /not managed by the organisation/.test(fcc.text), `status ${fcc.status}`);
  const fccG = await req("GET", "/directory/farm-credit-canada", { cookie: G });
  check("1g unclaimed profile has no Message button (signed-in)", !/>Message</.test(fccG.text) && !/Send message/i.test(fccG.text), "");
  const [fccP] = await q(`select id from "Profile" where slug='farm-credit-canada'`);
  const before = (await q(`select count(*)::int n from "Notification" where type='claim' and "userId"=$1`, [adminRow.id]))[0].n;
  const cl = await req("POST", "/api/v1/reports", { cookie: B, json: { targetType: "claim", targetId: fccP.id, reason: "QA claim request", details: `qa-admin ${rnd}` } });
  const rep = await q(`select id from "Report" where "targetType"='claim' and "targetId"=$1 and details=$2`, [fccP.id, `qa-admin ${rnd}`]);
  const after = (await q(`select count(*)::int n from "Notification" where type='claim' and "userId"=$1`, [adminRow.id]))[0].n;
  check("1h claim request creates Report + admin notification", cl.status === 200 && (rep.length === 1 || cl.body.duplicate) && (after > before || cl.body.duplicate), `status ${cl.status} ${JSON.stringify(cl.body)} reports=${rep.length} notif ${before}->${after}`);
  // clean: dismiss our claim report
  for (const x of rep) await req("POST", "/api/v1/admin/report", { cookie: A, json: { id: x.id, status: "dismissed", resolution: "QA test" } });
}

/* ---------------- 2. Partner programs ---------------- */
let resId;
{
  const om = await req("POST", "/api/v1/resources", { cookie: P, json: { type: "program", title: `QA NoDeadline ${rnd}`, summary: "Omitting the optional deadline field." } });
  check("2pre POST /resources without optional deadline accepted", om.status === 200, `status ${om.status} ${JSON.stringify(om.body.fields ?? "")}`);
  if (om.body.id) await req("DELETE", `/api/v1/resources/${om.body.id}`, { cookie: P });
  const title = `QA Program ${rnd}`;
  const c = await req("POST", "/api/v1/resources", { cookie: P, json: { type: "program", title, summary: "A QA test program summary text.", externalUrl: "example.org", deadline: null } });
  resId = c.body.id;
  const [row] = await q(`select approval from "Resource" where id=$1`, [resId ?? ""]);
  check("2a partner POST /resources -> pending", c.status === 200 && row?.approval === "pending", `${c.status} ${row?.approval}`);
  const l1 = await req("GET", "/resources");
  check("2b pending program not on /resources", !l1.text.includes(title));
  const d1 = await req("GET", `/resources/${resId}`);
  check("2c pending program detail 404 for public", d1.status === 404, `status ${d1.status}`);
  const ap = await req("POST", "/api/v1/admin/moderate", { cookie: A, json: { type: "resource", id: resId, action: "approve" } });
  const l2 = await req("GET", "/resources");
  check("2d admin approve -> visible on /resources", ap.status === 200 && l2.text.includes(title), `approve ${ap.status}`);
  const nBefore = (await q(`select count(*)::int n from "Notification" n join "User" u on u.id=n."userId" where u.email='partner@agrihub.test' and n.type='lead'`))[0].n;
  const i1 = await req("POST", `/api/v1/resources/${resId}`, { cookie: G, json: { message: "QA interested" } });
  const nAfter = (await q(`select count(*)::int n from "Notification" n join "User" u on u.id=n."userId" where u.email='partner@agrihub.test' and n.type='lead'`))[0].n;
  check("2e grower expresses interest -> notification", i1.status === 200 && !i1.body.already && nAfter === nBefore + 1, `${i1.status} ${JSON.stringify(i1.body)} notif ${nBefore}->${nAfter}`);
  const leads = await req("GET", "/dashboard/leads", { cookie: P });
  check("2f lead visible in partner /dashboard/leads", leads.status === 200 && leads.text.includes(title), `status ${leads.status}`);
  const i2 = await req("POST", `/api/v1/resources/${resId}`, { cookie: G, json: { message: "again" } });
  check("2g second interest -> already:true", i2.status === 200 && i2.body.already === true, JSON.stringify(i2.body));
  const [lead] = await q(`select id from "ResourceInterest" where "resourceId"=$1`, [resId]);
  const pa = await req("PATCH", `/api/v1/interests/${lead.id}`, { cookie: P, json: { status: "contacted" } });
  const [ls] = await q(`select status from "ResourceInterest" where id=$1`, [lead.id]);
  check("2h partner PATCH interest -> contacted", pa.status === 200 && ls.status === "contacted", `${pa.status} ${ls.status}`);
  const pb = await req("PATCH", `/api/v1/interests/${lead.id}`, { cookie: T, json: { status: "closed" } });
  check("2i other partner PATCH -> 404", pb.status === 404, `status ${pb.status}`);
  // pending-program interest (should a member be able to express interest in an unapproved program?)
  const c2 = await req("POST", "/api/v1/resources", { cookie: P, json: { type: "program", title: `QA Pending ${rnd}`, summary: "Pending program for QA checks.", deadline: null } });
  const ip = await req("POST", `/api/v1/resources/${c2.body.id}`, { cookie: G, json: { message: "x" } });
  check("2j interest in still-PENDING program rejected", ip.status === 404, `status ${ip.status} (pending program accepts interest)`);
  await req("DELETE", `/api/v1/resources/${c2.body.id}`, { cookie: P });
}

/* ---------------- 3. Events ---------------- */
{
  const base = { description: "QA event description text.", type: "webinar", onlineUrl: "https://example.org/qa" };
  const past = await req("POST", "/api/v1/events", { cookie: P, json: { ...base, title: `QA Past ${rnd}`, startsAt: new Date(Date.now() - 86400000).toISOString() } });
  check("3a past event -> 422", past.status === 422, `status ${past.status}`);
  const fut = new Date(Date.now() + 7 * 86400000).toISOString();
  const ev = await req("POST", "/api/v1/events", { cookie: P, json: { ...base, title: `QA Event ${rnd}`, startsAt: fut } });
  const [er] = await q(`select approval from "Event" where id=$1`, [ev.body.id ?? ""]);
  check("3b future event -> pending", ev.status === 200 && er?.approval === "pending", `${ev.status} ${er?.approval}`);
  const pre = await req("POST", `/api/v1/events/${ev.body.id}`, { cookie: G });
  check("3c RSVP on PENDING event rejected", pre.status === 404, `status ${pre.status} ${JSON.stringify(pre.body)}`);
  if (pre.body?.going) await req("POST", `/api/v1/events/${ev.body.id}`, { cookie: G }); // undo
  const ap = await req("POST", "/api/v1/admin/moderate", { cookie: A, json: { type: "event", id: ev.body.id, action: "approve" } });
  const evPage = await req("GET", "/events");
  check("3d admin approves -> on /events", ap.status === 200 && evPage.text.includes(`QA Event ${rnd}`));
  const r1 = await req("POST", `/api/v1/events/${ev.body.id}`, { cookie: G });
  const r2 = await req("POST", `/api/v1/events/${ev.body.id}`, { cookie: G });
  check("3e RSVP toggles on/off", r1.body.going === true && r1.body.count === 1 && r2.body.going === false && r2.body.count === 0, `${JSON.stringify(r1.body)} ${JSON.stringify(r2.body)}`);
  const cap = await req("POST", "/api/v1/events", { cookie: P, json: { ...base, title: `QA Cap1 ${rnd}`, startsAt: fut, capacity: 1 } });
  await req("POST", "/api/v1/admin/moderate", { cookie: A, json: { type: "event", id: cap.body.id, action: "approve" } });
  const c1 = await req("POST", `/api/v1/events/${cap.body.id}`, { cookie: G });
  const c2 = await req("POST", `/api/v1/events/${cap.body.id}`, { cookie: B });
  check("3f capacity 1: second RSVP -> 409", c1.status === 200 && c2.status === 409, `${c1.status} ${c2.status}`);
  // race: two parallel RSVPs on a fresh capacity-1 event
  const cap2 = await req("POST", "/api/v1/events", { cookie: P, json: { ...base, title: `QA Race ${rnd}`, startsAt: fut, capacity: 1 } });
  await req("POST", "/api/v1/admin/moderate", { cookie: A, json: { type: "event", id: cap2.body.id, action: "approve" } });
  const race = await Promise.all([req("POST", `/api/v1/events/${cap2.body.id}`, { cookie: G }), req("POST", `/api/v1/events/${cap2.body.id}`, { cookie: B }), req("POST", `/api/v1/events/${cap2.body.id}`, { cookie: T })]);
  const [{ n: raceN }] = await q(`select count(*)::int n from "EventRsvp" where "eventId"=$1`, [cap2.body.id]);
  check("3g capacity holds under concurrent RSVPs", raceN <= 1, `rsvps=${raceN} statuses=${race.map((x) => x.status)}`);
  for (const id of [ev.body.id, cap.body.id, cap2.body.id]) await req("DELETE", `/api/v1/events/${id}`, { cookie: P });
}

/* ---------------- 4. Community ---------------- */
{
  const [ann] = await q(`select id from "Space" where slug='announcements'`);
  const [ber] = await q(`select id from "Space" where slug='berries'`);
  const p1 = await req("POST", "/api/v1/posts", { cookie: G, json: { spaceId: ber.id, title: `QA post ${rnd}`, body: "QA community post body" } });
  check("4a member posts to space", p1.status === 200 && p1.body.id, `status ${p1.status}`);
  const p2 = await req("POST", "/api/v1/posts", { cookie: G, json: { spaceId: ann.id, body: "should be blocked" } });
  check("4b non-admin post to locked announcements -> 403", p2.status === 403, `status ${p2.status}`);
  const cm = await req("POST", `/api/v1/posts/${p1.body.id}`, { cookie: B, json: { action: "comment", body: "QA comment" } });
  const [{ n: cn }] = await q(`select count(*)::int n from "Comment" where "postId"=$1`, [p1.body.id]);
  const rx1 = await req("POST", `/api/v1/posts/${p1.body.id}`, { cookie: B, json: { action: "react" } });
  const rx2 = await req("POST", `/api/v1/posts/${p1.body.id}`, { cookie: B, json: { action: "react" } });
  check("4c comment + react toggle counts", cm.status === 200 && cn === 1 && rx1.body.liked === true && rx1.body.count === 1 && rx2.body.liked === false && rx2.body.count === 0, `${cn} ${JSON.stringify(rx1.body)} ${JSON.stringify(rx2.body)}`);
  const pin = await req("POST", `/api/v1/posts/${p1.body.id}`, { cookie: G, json: { action: "pin", pinned: true } });
  check("4d non-admin pin -> 403", pin.status === 403, `status ${pin.status}`);
  const del0 = await req("DELETE", `/api/v1/posts/${p1.body.id}`, { cookie: B });
  check("4e non-author DELETE -> 404", del0.status === 404, `status ${del0.status}`);
  const del = await req("DELETE", `/api/v1/posts/${p1.body.id}`, { cookie: G });
  const [gone] = await q(`select id from "Post" where id=$1`, [p1.body.id]);
  check("4f author deletes own post", del.status === 200 && !gone, `status ${del.status}`);
  const p3 = await req("POST", "/api/v1/posts", { cookie: G, json: { spaceId: ber.id, title: `QA hide ${rnd}`, body: "to be hidden by admin" } });
  const h = await req("POST", "/api/v1/admin/moderate", { cookie: A, json: { type: "post", id: p3.body.id, action: "hide" } });
  const pv = await req("GET", `/community/post/${p3.body.id}`, { cookie: B });
  const pvA = await req("GET", `/community/post/${p3.body.id}`, { cookie: A });
  check("4g admin hides post -> 404 for others, 200 admin", h.status === 200 && pv.status === 404 && pvA.status === 200, `others ${pv.status} admin ${pvA.status}`);
  const sp = await req("GET", "/community/berries");
  check("4h hidden post not listed in space", !sp.text.includes(`QA hide ${rnd}`));
  await req("DELETE", `/api/v1/posts/${p3.body.id}`, { cookie: A });
}

/* ---------------- 5. Admin moderation ---------------- */
{
  const lst = { title: `QA Listing ${rnd}`, produce: "Blueberries", category: "berries", volume: 100, unit: "lb", price: 3, photos: ["/seed/placeholder.svg"], status: "active", harvestStart: null, harvestEnd: null };
  const cats = await q(`select distinct category::text c from "Listing" limit 1`);
  if (cats[0]) lst.category = cats[0].c;
  const units = await q(`select distinct unit from "Listing" limit 1`);
  if (units[0]) lst.unit = units[0].unit;
  const c = await req("POST", "/api/v1/listings", { cookie: G, json: lst });
  check("5a grower creates listing (pending)", c.status === 200 && c.body.approval === "pending", `${c.status} ${JSON.stringify(c.body).slice(0, 200)}`);
  const id = c.body.id;
  const [{ email: gEmail, id: gId }] = await q(`select email,id from "User" where email='grower@agrihub.test'`);
  const t0 = new Date();
  const rj = await req("POST", "/api/v1/admin/moderate", { cookie: A, json: { type: "listing", id, action: "reject", reason: "QA reject reason" } });
  const nt = await q(`select title, body from "Notification" where "userId"=$1 and "createdAt">=$2 and type='moderation'`, [gId, t0]);
  const em = await q(`select subject from "EmailOutbox" where "to"=$1 and "createdAt">=$2`, [gEmail, t0]);
  const [lr] = await q(`select approval, "rejectionReason" from "Listing" where id=$1`, [id]);
  check("5b reject with reason -> Notification + EmailOutbox", rj.status === 200 && lr.approval === "rejected" && lr.rejectionReason === "QA reject reason" && nt.some((n) => n.body === "QA reject reason") && em.length >= 1, `notif=${nt.length} emails=${em.length}`);
  const rjList = await req("GET", `/api/v1/listings?q=${encodeURIComponent(lst.title)}`);
  check("5c rejected listing hidden from /api/v1/listings", !rjList.text.includes(lst.title));
  const ap = await req("POST", "/api/v1/admin/moderate", { cookie: A, json: { type: "listing", id, action: "approve" } });
  const [la] = await q(`select approval, "rejectionReason" from "Listing" where id=$1`, [id]);
  check("5d approve -> approved, reason cleared", ap.status === 200 && la.approval === "approved" && la.rejectionReason === null);
  await req("POST", "/api/v1/admin/moderate", { cookie: A, json: { type: "listing", id, action: "feature" } });
  const [f1] = await q(`select "isFeatured" from "Listing" where id=$1`, [id]);
  await req("POST", "/api/v1/admin/moderate", { cookie: A, json: { type: "listing", id, action: "unfeature" } });
  const [f2] = await q(`select "isFeatured" from "Listing" where id=$1`, [id]);
  check("5e feature/unfeature", f1.isFeatured === true && f2.isFeatured === false);
  // pre-moderation
  const settings = Object.fromEntries((await q(`select key, value from "SiteSetting"`)).map((r) => [r.key, r.value]));
  const sBody = (mode) => ({ moderation: mode, announcement: settings.announcement ?? "", requireEmailVerificationToMessage: settings.requireEmailVerificationToMessage ?? false });
  let id2;
  try {
    const sw = await req("POST", "/api/v1/admin/settings", { cookie: A, json: sBody("pre") });
    const c2 = await req("POST", "/api/v1/listings", { cookie: G, json: { ...lst, title: `QA PreMod ${rnd}` } });
    id2 = c2.body.id;
    const hid = await req("GET", `/api/v1/listings?q=${encodeURIComponent(`QA PreMod ${rnd}`)}`);
    const [slug] = await q(`select slug from "Listing" where id=$1`, [id2]);
    const det = await req("GET", `/marketplace/${slug.slug}`);
    const prof = await req("GET", `/directory/sumas-prairie-berry-co`);
    check("5f pre-moderation: new pending listing hidden from /api/v1/listings", sw.status === 200 && c2.body.moderation === "pre" && hid.body.total === 0, `switch ${sw.status} total=${hid.body.total}`);
    check("5g pre-moderation: pending listing hidden on /marketplace/<slug> (public)", det.status === 404, `status ${det.status}`);
    const [gp] = await q(`select slug from "Profile" where "userId"=$1`, [gId]);
    const prof2 = gp.slug === "sumas-prairie-berry-co" ? prof : await req("GET", `/directory/${gp.slug}`);
    check("5h pre-moderation: pending listing hidden on grower directory profile", !prof2.text.includes(`QA PreMod ${rnd}`), `profile /directory/${gp.slug} shows pending listing`);
  } finally {
    const back = await req("POST", "/api/v1/admin/settings", { cookie: A, json: sBody("post") });
    const [m] = await q(`select value from "SiteSetting" where key='moderation'`);
    check("5i moderation switched back to post", back.status === 200 && m.value === "post", `status ${back.status} value ${JSON.stringify(m.value)}`);
  }
  const vis = await req("GET", `/api/v1/listings?q=${encodeURIComponent(`QA PreMod ${rnd}`)}`);
  check("5j post-moderation: pending listing now visible", vis.body.total === 1, `total=${vis.body.total}`);
  for (const x of [id, id2]) if (x) await req("DELETE", `/api/v1/listings/${x}`, { cookie: G });
}

/* ---------------- 6. Admin users ---------------- */
{
  const tu = await signup("grower");
  const meBefore = await req("GET", "/api/v1/auth/me", { cookie: tu.cookie });
  const sus = await req("POST", "/api/v1/admin/user", { cookie: A, json: { id: tu.id, action: "suspend", reason: "QA" } });
  const meAfter = await req("GET", "/api/v1/auth/me", { cookie: tu.cookie });
  check("6a suspend -> existing cookie dead (me user:null)", meBefore.body.user?.id === tu.id && sus.status === 200 && meAfter.body.user === null, `suspend ${sus.status} me=${JSON.stringify(meAfter.body).slice(0, 60)}`);
  const lg = await login(tu.email, "member", tu.password);
  check("6b suspended login -> 403", lg.r.status === 403, `status ${lg.r.status}`);
  const act = await req("POST", "/api/v1/admin/user", { cookie: A, json: { id: tu.id, action: "activate" } });
  const lg2 = await login(tu.email, "member", tu.password);
  check("6c reactivate -> login works", act.status === 200 && lg2.r.status === 200, `status ${lg2.r.status}`);
  const vf = await req("POST", "/api/v1/admin/user", { cookie: A, json: { id: tu.id, action: "verify" } });
  const [vr] = await q(`select "isVerified" from "User" where id=$1`, [tu.id]);
  const [pslug] = await q(`select slug from "Profile" where "userId"=$1`, [tu.id]);
  const pp = await req("GET", `/directory/${pslug.slug}`);
  check("6d verify badge set (DB + profile page)", vf.status === 200 && vr.isVerified && pp.status === 200 && /[Vv]erified/.test(pp.text), `profile ${pp.status}`);
  const self = await req("POST", "/api/v1/admin/user", { cookie: A, json: { id: adminRow.id, action: "suspend" } });
  check("6e admin cannot suspend self -> 422", self.status === 422, `status ${self.status}`);
  const actions = ["moderate", "cert", "user", "report", "kpis", "settings", "space", "region"];
  const non = [];
  for (const a of actions) {
    for (const [n, ck] of [["grower", G], ["partner", P]]) {
      const r = await req("POST", `/api/v1/admin/${a}`, { cookie: ck, json: {} });
      if (r.status !== 403) non.push(`${n}/${a}:${r.status}`);
    }
  }
  const anon = await req("POST", "/api/v1/admin/settings", { json: { moderation: "pre", announcement: "", requireEmailVerificationToMessage: false } });
  check("6f non-admin /api/v1/admin/* -> 403 (anon 401)", non.length === 0 && anon.status === 401, `${non.join(",")} anon=${anon.status}`);
  globalThis.__tu = tu;
}

/* ---------------- 7. KPI targets + admin pages ---------------- */
{
  const [k] = await q(`select * from "KpiTarget" order by "sortOrder" limit 1`);
  const newVal = Math.round(k.targetValue) + 7;
  const u = await req("POST", "/api/v1/admin/kpis", { cookie: A, json: { items: [{ key: k.key, label: k.label, targetValue: newVal, targetLabel: `QA ${rnd}` }] } });
  const ov = await req("GET", "/admin", { cookie: A });
  check("7a KPI target update reflected on /admin", u.status === 200 && ov.text.includes(`QA ${rnd}`), `status ${u.status}`);
  await req("POST", "/api/v1/admin/kpis", { cookie: A, json: { items: [{ key: k.key, label: k.label, targetValue: k.targetValue, targetLabel: k.targetLabel ?? "" }] } });
  const unk = await req("POST", "/api/v1/admin/kpis", { cookie: A, json: { items: [{ key: "does-not-exist", label: "x", targetValue: 1 }] } });
  check("7b KPI unknown key -> 4xx (not 500)", unk.status >= 400 && unk.status < 500, `status ${unk.status}`);
  const [anyUser] = await q(`select id from "User" where email='grower@agrihub.test'`);
  const pages = ["/admin", ...["listings", "profiles", "resources", "events", "demand", "certs"].map((t) => `/admin/approvals?tab=${t}`), "/admin/users", `/admin/users/${anyUser.id}`, "/admin/reports", "/admin/kpis", "/admin/settings", "/admin/audit", "/admin/mailbox", "/admin/security", "/admin/listings/new"];
  const badA = [], badG = [];
  for (const p of pages) {
    const ra = await req("GET", p, { cookie: A });
    if (ra.status !== 200) badA.push(`${p}:${ra.status}`);
    const rg = await req("GET", p, { cookie: G });
    if (!(rg.status === 404 || (rg.status >= 300 && rg.status < 400))) badG.push(`${p}:${rg.status}`);
  }
  check("7c all admin pages 200 for admin", badA.length === 0, badA.join(","));
  check("7d admin pages 404/redirect for grower", badG.length === 0, badG.join(","));
  const anonA = await req("GET", "/admin/users");
  check("7e admin page anon -> redirect", anonA.status >= 300 && anonA.status < 400, `status ${anonA.status}`);
}

/* ---------------- 8. Regions ---------------- */
{
  const name = `QA Region ${rnd}`;
  const r = await req("POST", "/api/v1/admin/region", { cookie: A, json: { name, province: "AB", country: "ca", lat: 51.04, lng: -114.07, specialties: ["canola"] } });
  const st = await req("GET", "/admin/settings", { cookie: A });
  const mk = await req("GET", "/marketplace");
  const dir = await req("GET", "/directory");
  const [rg] = await q(`select "isActive", country, slug from "Region" where id=$1`, [r.body.id ?? ""]);
  check("8a region created and listed in /admin/settings", r.status === 200 && st.text.includes(name), `status ${r.status}`);
  check("8b new region (isActive default true) in /marketplace + /directory filter", mk.text.includes(name) && dir.text.includes(name), `active=${rg?.isActive} country=${rg?.country}`);
  const dup = await req("POST", "/api/v1/admin/region", { cookie: A, json: { name, province: "AB", country: "CA", lat: 51, lng: -114 } });
  check("8c duplicate region -> 409 (not 500)", dup.status === 409, `status ${dup.status}`);
  globalThis.__region = { id: r.body.id, name };
}

/* ---------------- 9. Audit ---------------- */
{
  const rows = await q(`select action from "AuditLog" where "actorId"=$1 and "createdAt">=$2`, [adminRow.id, startedAt]);
  const acts = new Set(rows.map((r) => r.action));
  const need = ["resource.approve", "event.approve", "post.hide", "listing.reject", "listing.approve", "listing.feature", "listing.unfeature", "settings.update", "user.suspend", "user.activate", "user.verify", "kpis.update", "region.create", "report.dismissed"];
  const missing = need.filter((a) => !acts.has(a));
  check("9a audit rows for admin actions", missing.length === 0, missing.length ? `missing ${missing.join(",")}` : `${rows.length} rows`);
  const au = await req("GET", "/admin/audit", { cookie: A });
  check("9b /admin/audit shows region.create", au.text.includes("region.create"));
}

console.log(`\nTest user: ${globalThis.__tu?.email}  region: ${JSON.stringify(globalThis.__region)}`);
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
await db.end();
