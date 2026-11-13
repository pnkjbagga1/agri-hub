import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, fail, zOptText, zReqText } from "@/server/api";
import { audit, notify, sendEmail } from "@/server/notify";
import { setSetting } from "@/server/settings";
import { matchSavedSearches } from "@/server/alerts";
import { notifyDemandMatches } from "@/server/demand";
import { revokeAllSessions } from "@/server/session";
import { slugify } from "@/lib/utils";

const ADMIN = { auth: ["admin" as const], rateLimit: [300, 60] as [number, number], name: "admin" };

const moderate = z.object({
  type: z.enum(["listing", "profile", "resource", "event", "demand", "post", "comment", "review"]),
  id: z.string().max(40),
  action: z.enum(["approve", "reject", "feature", "unfeature", "hide", "unhide"]),
  reason: zOptText(500),
});

export const POST = handler<{ action: string }>(ADMIN, async ({ req, params, user }) => {
  switch (params.action) {
    /* ---------- content moderation ---------- */
    case "moderate": {
      const d = await body(req, moderate);
      const approval = d.action === "approve" ? "approved" : d.action === "reject" ? "rejected" : undefined;
      const featured = d.action === "feature" ? true : d.action === "unfeature" ? false : undefined;
      const hidden = d.action === "hide" ? true : d.action === "unhide" ? false : undefined;
      let owner: string | null = null;
      let label = "";
      let link = "/dashboard";
      switch (d.type) {
        case "listing": {
          const l = await db.listing.update({ where: { id: d.id }, data: { ...(approval && { approval, rejectionReason: approval === "rejected" ? d.reason : null }), ...(featured !== undefined && { isFeatured: featured }) } });
          owner = l.growerId;
          label = l.title;
          link = `/marketplace/${l.slug}`;
          if (approval === "approved" && l.status === "active") await matchSavedSearches(l.id);
          break;
        }
        case "profile": {
          const p = await db.profile.update({ where: { id: d.id }, data: { ...(approval && { approval }), ...(featured !== undefined && { isFeatured: featured }) } });
          owner = p.userId;
          label = p.orgName;
          link = `/directory/${p.slug}`;
          break;
        }
        case "resource": {
          const r = await db.resource.update({ where: { id: d.id }, data: { ...(approval && { approval }), ...(featured !== undefined && { isFeatured: featured }) }, include: { profile: { select: { userId: true } } } });
          owner = r.profile.userId;
          label = r.title;
          link = `/resources/${r.id}`;
          break;
        }
        case "event": {
          const e = await db.event.update({ where: { id: d.id }, data: { ...(approval && { approval }) }, include: { host: { select: { userId: true } } } });
          owner = e.host?.userId ?? null;
          label = e.title;
          link = `/events/${e.id}`;
          break;
        }
        case "demand": {
          const x = await db.demandPost.update({ where: { id: d.id }, data: { ...(approval && { approval }) } });
          owner = x.buyerId;
          label = x.title;
          link = `/demand/${x.id}`;
          if (approval === "approved") await notifyDemandMatches(x.id);
          break;
        }
        case "post":
          await db.post.update({ where: { id: d.id }, data: { ...(hidden !== undefined && { isHidden: hidden }) } });
          break;
        case "comment":
          await db.comment.update({ where: { id: d.id }, data: { ...(hidden !== undefined && { isHidden: hidden }) } });
          break;
        case "review":
          await db.review.update({ where: { id: d.id }, data: { ...(hidden !== undefined && { isHidden: hidden }) } });
          break;
      }
      if (owner && approval) {
        await notify(owner, { type: "moderation", title: approval === "approved" ? `Approved: ${label}` : `Not approved: ${label}`, body: d.reason ?? undefined, link, email: approval === "rejected" });
      }
      await audit(user.id, `${d.type}.${d.action}`, d.type, d.id, { reason: d.reason });
      return { ok: true };
    }

    /* ---------- certificate verification ---------- */
    case "cert": {
      const d = await body(req, z.object({ id: z.string().max(40), status: z.enum(["verified", "rejected"]), note: zOptText(500) }));
      const doc = await db.certificationDoc.update({ where: { id: d.id }, data: { status: d.status, reviewNote: d.note }, include: { profile: true } });
      if (d.status === "verified" && !doc.profile.certifications.includes(doc.type) && doc.type !== "other") {
        const certs = [...doc.profile.certifications, doc.type];
        await db.profile.update({ where: { id: doc.profileId }, data: { certifications: certs } });
        await db.listing.updateMany({ where: { growerId: doc.profile.userId, status: { not: "archived" } }, data: { certifications: certs } });
      }
      await notify(doc.profile.userId, { type: "cert", title: d.status === "verified" ? `Certificate verified: ${doc.type}` : `Certificate not verified: ${doc.type}`, body: d.note ?? undefined, link: "/dashboard/profile#certificates", email: true });
      await audit(user.id, `cert.${d.status}`, "certificate", d.id);
      return { ok: true };
    }

    /* ---------- users ---------- */
    case "user": {
      const d = await body(req, z.object({ id: z.string().max(40), action: z.enum(["suspend", "activate", "verify", "unverify", "revoke_sessions", "resend_verification"]), reason: zOptText(500) }));
      if (d.id === user.id && (d.action === "suspend" || d.action === "revoke_sessions")) fail(422, "You can't do that to your own account.");
      const target = await db.user.findUnique({ where: { id: d.id } });
      if (!target) fail(404, "User not found.");
      if (target!.role === "admin" && d.action === "suspend") fail(422, "Admins can't be suspended here.");
      const data =
        d.action === "suspend"
          ? { status: "suspended" as const, sessionVersion: { increment: 1 } }
          : d.action === "activate"
            ? { status: "active" as const, failedLogins: 0, lockedUntil: null }
            : d.action === "verify"
              ? { isVerified: true }
              : d.action === "unverify"
                ? { isVerified: false }
                : d.action === "revoke_sessions"
                  ? { sessionVersion: { increment: 1 } }
                  : {};
      await db.user.update({ where: { id: d.id }, data });
      if (d.action === "suspend" || d.action === "revoke_sessions") await revokeAllSessions(d.id);
      if (d.action === "verify") await notify(d.id, { type: "verified", title: "Your organisation is now verified on AGRI HUB ✓", link: "/dashboard", email: true });
      if (d.action === "suspend") await sendEmail(target!.email, "Your AGRI HUB account has been suspended", [`Your account was suspended${d.reason ? `: ${d.reason}` : ""}.`, "Contact support@griscanada.org if you believe this is a mistake."]);
      if (d.action === "resend_verification") {
        const { sendVerificationEmail } = await import("@/server/accounts");
        await sendVerificationEmail(target!);
      }
      await audit(user.id, `user.${d.action}`, "user", d.id, { reason: d.reason });
      return { ok: true };
    }

    /* ---------- reports & claims ---------- */
    case "report": {
      const d = await body(req, z.object({ id: z.string().max(40), status: z.enum(["resolved", "dismissed"]), resolution: zOptText(500) }));
      const r = await db.report.update({ where: { id: d.id }, data: { status: d.status, resolution: d.resolution, resolvedAt: new Date() } });
      await notify(r.reporterId, { type: "report", title: r.targetType === "claim" ? `Your profile claim was ${d.status === "resolved" ? "approved" : "declined"}` : "Thanks — your report was reviewed", body: d.resolution ?? undefined });
      await audit(user.id, `report.${d.status}`, "report", d.id);
      return { ok: true };
    }

    /* ---------- KPI targets (configurable, not hard-coded) ---------- */
    case "kpis": {
      const d = await body(req, z.object({ items: z.array(z.object({ key: z.string().max(40), label: zReqText(120), targetValue: z.coerce.number().min(0), targetLabel: zOptText(60), currentValue: z.coerce.number().optional().nullable() })).max(50) }));
      const known = new Set((await db.kpiTarget.findMany({ select: { key: true } })).map((k) => k.key));
      const unknown = d.items.filter((k) => !known.has(k.key)).map((k) => k.key);
      if (unknown.length) fail(404, `Unknown KPI key(s): ${unknown.join(", ")}`);
      await db.$transaction(d.items.map((k) => db.kpiTarget.update({ where: { key: k.key }, data: { label: k.label, targetValue: k.targetValue, targetLabel: k.targetLabel, ...(k.currentValue !== undefined && { currentValue: k.currentValue }) } })));
      await audit(user.id, "kpis.update", "kpi", undefined, { count: d.items.length });
      return { ok: true };
    }

    /* ---------- site settings ---------- */
    case "settings": {
      const d = await body(req, z.object({ moderation: z.enum(["post", "pre"]), announcement: zOptText(240), requireEmailVerificationToMessage: z.boolean() }));
      await setSetting("moderation", d.moderation);
      await setSetting("announcement", d.announcement);
      await setSetting("requireEmailVerificationToMessage", d.requireEmailVerificationToMessage);
      await audit(user.id, "settings.update", "settings", undefined, d);
      return { ok: true };
    }

    /* ---------- community spaces ---------- */
    case "space": {
      const d = await body(req, z.object({ name: zReqText(60, 2), description: zOptText(240), isLocked: z.boolean().default(false) }));
      const slug = slugify(d.name);
      if (await db.space.findUnique({ where: { slug } })) fail(409, "A space with that name exists.");
      const s = await db.space.create({ data: { ...d, slug, sortOrder: (await db.space.count()) + 1 } });
      await audit(user.id, "space.create", "space", s.id);
      return { ok: true, id: s.id };
    }

    /* ---------- regions (scale to new provinces / countries without code) ---------- */
    case "region": {
      const d = await body(req, z.object({ name: zReqText(80, 2), province: zReqText(10, 2), country: zReqText(2, 2), lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180), specialties: z.array(z.string().max(40)).max(10).default([]) }));
      const slug = slugify(`${d.name}-${d.province}`);
      if (await db.region.findUnique({ where: { slug } })) fail(409, "That region already exists.");
      const r = await db.region.create({ data: { ...d, country: d.country.toUpperCase(), slug, sortOrder: (await db.region.count()) + 1 } });
      await audit(user.id, "region.create", "region", r.id);
      return { ok: true, id: r.id };
    }
  }
  fail(404, "Unknown admin action.");
});
