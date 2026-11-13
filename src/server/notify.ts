import "server-only";
import { db } from "@/lib/db";
import { APP_NAME } from "@/lib/constants";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Sends a transactional email. With SENDGRID_API_KEY set it goes out through
 * SendGrid; every email is also stored in the outbox that admins can read at
 * /admin/mailbox (useful in development and for support).
 */
export async function sendEmail(to: string, subject: string, lines: string[], cta?: { label: string; href: string }) {
  const href = cta ? (cta.href.startsWith("http") ? cta.href : appUrl() + cta.href) : null;
  const text = [...lines, href ? `\n${cta!.label}: ${href}` : "", `\n— ${APP_NAME} by GRIS Canada`].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1A2B1A">
  <div style="padding:20px 0;border-bottom:3px solid #C99A2E"><strong style="font-size:20px;color:#0B5A14">${APP_NAME}</strong> <span style="color:#5C6B28">by GRIS Canada</span></div>
  ${lines.map((l) => `<p style="line-height:1.55">${escapeHtml(l)}</p>`).join("")}
  ${href ? `<p><a href="${escapeHtml(href)}" style="display:inline-block;background:#0B5A14;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${escapeHtml(cta!.label)}</a></p>` : ""}
  <p style="color:#777;font-size:12px;margin-top:32px">GRIS Canada — Green Revolution Innovation Society · Abbotsford, BC</p></div>`;

  let provider = "outbox";
  let status = "stored";
  if (process.env.SENDGRID_API_KEY) {
    provider = "sendgrid";
    try {
      const from = process.env.EMAIL_FROM ?? "AGRI HUB <no-reply@griscanada.org>";
      const m = from.match(/^(.*)<(.+)>$/);
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: m ? { name: m[1]!.trim(), email: m[2]!.trim() } : { email: from },
          subject,
          content: [
            { type: "text/plain", value: text },
            { type: "text/html", value: html },
          ],
        }),
      });
      status = res.ok ? "sent" : `failed:${res.status}`;
    } catch {
      status = "failed";
    }
  }
  await db.emailOutbox.create({ data: { to, subject, html, text, provider, status } });
}

/** In-app notification, optionally mirrored to email. */
export async function notify(
  userId: string,
  n: { type: string; title: string; body?: string; link?: string; payload?: object; email?: boolean },
) {
  await db.notification.create({ data: { userId, type: n.type, title: n.title, body: n.body, link: n.link, payload: n.payload } });
  if (n.email) {
    const u = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (u) await sendEmail(u.email, n.title, [n.body ?? n.title], n.link ? { label: "Open in AGRI HUB", href: n.link } : undefined);
  }
}

export async function notifyAdmins(n: { type: string; title: string; body?: string; link?: string }) {
  const admins = await db.user.findMany({ where: { role: "admin", status: "active" }, select: { id: true } });
  if (!admins.length) return;
  await db.notification.createMany({ data: admins.map((a) => ({ userId: a.id, ...n })) });
}

export async function audit(actorId: string | null, action: string, targetType?: string, targetId?: string, meta?: object) {
  await db.auditLog.create({ data: { actorId, action, targetType, targetId, meta } });
}

export async function track(type: string, data: { userId?: string | null; listingId?: string; profileId?: string; ownerId?: string; meta?: object }) {
  await db.activityEvent.create({ data: { type, userId: data.userId ?? null, listingId: data.listingId, profileId: data.profileId, ownerId: data.ownerId, meta: data.meta } });
}
