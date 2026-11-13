import { z } from "zod";
import { db } from "@/lib/db";
import { demandSchema } from "./schema";
import { handler, body, zDate, zOptText, zReqText } from "@/server/api";
import { assertCanAct } from "@/server/rules";
import { notifyAdmins } from "@/server/notify";
import { notifyDemandMatches } from "@/server/demand";
import { getSettings } from "@/server/settings";
import { CATEGORIES, FREQUENCIES, UNITS } from "@/lib/constants";

/** Buyers post what they need; growers with matching produce are notified. */
export const POST = handler({ auth: ["buyer"], rateLimit: [20, 3600], name: "demand" }, async ({ req, user }) => {
  await assertCanAct(user);
  const d = await body(req, demandSchema);
  const post = await db.demandPost.create({ data: { ...d, category: d.category as never, buyerId: user.id, regionId: d.regionId ?? user.profile?.regionId ?? null } });
  // demand matching: notify growers now if the post is visible, otherwise when a moderator approves it
  const settings = await getSettings();
  const matched = settings.moderation === "post" ? await notifyDemandMatches(post.id) : 0;
  await notifyAdmins({ type: "review_demand", title: `New demand post: ${d.title}`, link: "/admin/approvals?tab=demand" });
  return { ok: true, id: post.id, matchedGrowers: matched };
});
