import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, fail, zOptText } from "@/server/api";
import { assertCanAct } from "@/server/rules";
import { notify, track } from "@/server/notify";
import { resourceSchema } from "../schema";

async function own(id: string, user: { id: string; role: string; profile: { id: string } | null }) {
  const r = await db.resource.findUnique({ where: { id } });
  if (!r) fail(404, "Not found.");
  if (r!.profileId !== user.profile?.id && user.role !== "admin") fail(403, "Not your program.");
  return r!;
}

export const PATCH = handler<{ id: string }>({ auth: true }, async ({ req, params, user }) => {
  const r = await own(params.id, user);
  const d = await body(req, resourceSchema);
  await db.resource.update({ where: { id: r.id }, data: { ...d, type: d.type as never, approval: r.approval === "rejected" ? "pending" : r.approval } });
  return { ok: true };
});

export const DELETE = handler<{ id: string }>({ auth: true }, async ({ params, user }) => {
  await own(params.id, user);
  await db.resource.delete({ where: { id: params.id } });
  return { ok: true };
});

/** Express interest / referral request (one per member per program). */
export const POST = handler<{ id: string }>({ auth: true, rateLimit: [30, 3600], name: "interest" }, async ({ req, params, user }) => {
  await assertCanAct(user);
  const r = await db.resource.findUnique({ where: { id: params.id }, include: { profile: { select: { userId: true, isClaimed: true, orgName: true } } } });
  if (!r || r.approval !== "approved") fail(404, "Program not found.");
  if (r!.profile.userId === user.id) fail(422, "This is your own program.");
  const { message } = await body(req, z.object({ message: zOptText(1500) }));
  const existing = await db.resourceInterest.findUnique({ where: { resourceId_userId: { resourceId: r!.id, userId: user.id } } });
  if (existing) return { ok: true, already: true };
  await db.resourceInterest.create({ data: { resourceId: r!.id, userId: user.id, message } });
  await track("resource_interest", { userId: user.id, ownerId: r!.profile.userId });
  if (r!.profile.isClaimed) {
    await notify(r!.profile.userId, { type: "lead", title: `New interest in “${r!.title}”`, body: `${user.profile?.orgName}: ${message ?? "wants to learn more."}`, link: "/dashboard/leads", email: true });
  }
  return { ok: true, externalUrl: r!.externalUrl, unclaimed: !r!.profile.isClaimed };
});
