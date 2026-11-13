import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, zOptText, zReqText } from "@/server/api";
import { notifyAdmins } from "@/server/notify";

/** Flag content or members for moderation. Also used to request to claim an unclaimed profile. */
export const POST = handler({ auth: true, rateLimit: [10, 3600], name: "report" }, async ({ req, user }) => {
  const d = await body(
    req,
    z.object({ targetType: z.enum(["listing", "user", "profile", "message", "post", "comment", "review", "demand", "resource", "event", "claim"]), targetId: z.string().max(40), reason: zReqText(120), details: zOptText(2000) }),
  );
  const dup = await db.report.findFirst({ where: { reporterId: user.id, targetType: d.targetType, targetId: d.targetId, status: "open" } });
  if (dup) return { ok: true, duplicate: true };
  await db.report.create({ data: { reporterId: user.id, ...d } });
  await notifyAdmins({ type: d.targetType === "claim" ? "claim" : "report", title: d.targetType === "claim" ? `Profile claim request from ${user.profile?.orgName ?? user.email}` : `New report: ${d.reason} (${d.targetType})`, link: "/admin/reports" });
  return { ok: true };
});
