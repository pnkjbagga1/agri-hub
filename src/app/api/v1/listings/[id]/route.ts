import { z } from "zod";
import { db } from "@/lib/db";
import { handler, fail } from "@/server/api";
import { listingSchema } from "../schema";
import { audit } from "@/server/notify";
import { assertOwnedMedia } from "@/server/rules";
import { matchSavedSearches } from "@/server/alerts";
import { getSettings } from "@/server/settings";

async function maybeAlert(id: string) {
  const l = await db.listing.findUnique({ where: { id }, select: { id: true, status: true, approval: true } });
  if (!l || l.status !== "active") return;
  const s = await getSettings();
  if (l.approval === "approved" || (s.moderation === "post" && l.approval !== "rejected")) await matchSavedSearches(l.id);
}

async function ownListing(id: string, user: { id: string; role: string }) {
  const l = await db.listing.findUnique({ where: { id } });
  if (!l) fail(404, "Listing not found.");
  if (l!.growerId !== user.id && user.role !== "admin") fail(403, "You can only manage your own listings.");
  return l!;
}

export const PATCH = handler<{ id: string }>({ auth: ["grower", "admin"], rateLimit: [120, 3600], name: "listing-edit" }, async ({ req, params, user }) => {
  const l = await ownListing(params.id, user);
  const json: unknown = await req.json().catch(() => fail(400, "Invalid JSON body."));
  // quick status change (pause / resume / sold out) from the dashboard table
  if (json && typeof json === "object" && Object.keys(json).length === 1 && "status" in json) {
    const { status } = z.object({ status: z.enum(["draft", "active", "paused", "sold_out", "archived"]) }).parse(json);
    if (status === "active" && l.photos.length === 0) fail(422, "Add at least one photo before publishing.");
    await db.listing.update({ where: { id: l.id }, data: { status } });
    if (status === "active" && l.status !== "active") await maybeAlert(l.id);
    return { ok: true };
  }
  const data = listingSchema.parse(json);
  const { growerId: _g, ...rest } = data;
  void _g;
  await assertOwnedMedia(rest.photos, [l.growerId, user.id]);
  if (rest.regionId && !(await db.region.findUnique({ where: { id: rest.regionId } }))) fail(422, "Unknown region.", { regionId: "Unknown region" });
  const resubmit = l.approval === "rejected";
  await db.listing.update({
    where: { id: l.id },
    data: { ...rest, category: data.category as never, approval: user.role === "admin" ? l.approval : resubmit ? "pending" : l.approval, rejectionReason: resubmit ? null : l.rejectionReason },
  });
  if (user.role === "admin") await audit(user.id, "listing.admin_edit", "listing", l.id);
  if (rest.status === "active" && l.status !== "active") await maybeAlert(l.id);
  return { ok: true };
});

export const DELETE = handler<{ id: string }>({ auth: ["grower", "admin"] }, async ({ params, user }) => {
  const l = await ownListing(params.id, user);
  // soft delete keeps message history and traceability lot pages intact
  await db.listing.update({ where: { id: l.id }, data: { status: "archived" } });
  await audit(user.id, "listing.archive", "listing", l.id);
  return { ok: true };
});
