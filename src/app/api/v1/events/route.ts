import { z } from "zod";
import { db } from "@/lib/db";
import { eventSchema } from "./schema";
import { handler, body, fail, zMedia, zOptText, zReqText, zUrl } from "@/server/api";
import { assertCanAct, assertOwnedMedia } from "@/server/rules";
import { notifyAdmins } from "@/server/notify";
import { EVENT_TYPES, PARTNER_ROLES } from "@/lib/constants";

export const POST = handler({ auth: [...PARTNER_ROLES, "admin"], rateLimit: [20, 3600], name: "event" }, async ({ req, user }) => {
  await assertCanAct(user);
  const d = await body(req, eventSchema);
  await assertOwnedMedia([d.coverUrl], [user.id]);
  if (d.startsAt < new Date()) fail(422, "Events must start in the future.", { startsAt: "Must be in the future" });
  const e = await db.event.create({ data: { ...d, type: d.type as never, hostProfileId: user.profile?.id ?? null, approval: user.role === "admin" ? "approved" : "pending" } });
  await notifyAdmins({ type: "review_event", title: `Event to review: ${d.title}`, link: "/admin/approvals?tab=events" });
  return { ok: true, id: e.id };
});
