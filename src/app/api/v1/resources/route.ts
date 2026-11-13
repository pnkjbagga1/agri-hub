import { z } from "zod";
import { db } from "@/lib/db";
import { resourceSchema } from "./schema";
import { handler, body, fail, zDate, zOptText, zReqText, zUrl } from "@/server/api";
import { assertCanAct } from "@/server/rules";
import { notifyAdmins } from "@/server/notify";
import { PARTNER_ROLES, RESOURCE_TYPES } from "@/lib/constants";

/** Partners post programs, grants, financing offers, courses, demos and services. */
export const POST = handler({ auth: [...PARTNER_ROLES, "admin"], rateLimit: [20, 3600], name: "resource" }, async ({ req, user }) => {
  await assertCanAct(user);
  if (!user.profile) fail(400, "Complete your profile first.");
  const d = await body(req, resourceSchema);
  const r = await db.resource.create({ data: { ...d, type: d.type as never, profileId: user.profile!.id, approval: user.role === "admin" ? "approved" : "pending" } });
  await notifyAdmins({ type: "review_resource", title: `Program to review: ${d.title}`, link: "/admin/approvals?tab=resources" });
  return { ok: true, id: r.id };
});
