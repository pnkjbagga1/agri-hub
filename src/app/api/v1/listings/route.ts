import { db } from "@/lib/db";
import { handler, body, fail } from "@/server/api";
import { listingSchema } from "./schema";
import { assertCanAct, assertOwnedMedia } from "@/server/rules";
import { searchListings } from "@/server/queries";
import { audit, notify, notifyAdmins } from "@/server/notify";
import { getSettings } from "@/server/settings";
import { matchSavedSearches } from "@/server/alerts";
import { randomSuffix, slugify } from "@/lib/utils";

/** Public JSON search — same filters as the Browse page (for apps and integrations). */
export const GET = handler({ rateLimit: [120, 60], name: "listings-get" }, async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const list = (k: string) => sp.getAll(k).flatMap((v) => v.split(",")).filter(Boolean);
  const r = await searchListings({ q: sp.get("q") ?? undefined, category: list("category"), region: list("region"), cert: list("cert"), sort: sp.get("sort") ?? undefined, page: Number(sp.get("page")) || 1, season: sp.get("season") ?? undefined });
  return {
    total: r.total,
    page: r.page,
    pages: r.pages,
    items: r.items.map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      produce: l.produce,
      category: l.category,
      price: l.price,
      priceUnit: l.priceUnit,
      volume: l.volume,
      unit: l.unit,
      harvestStart: l.harvestStart,
      harvestEnd: l.harvestEnd,
      region: l.region?.name,
      grower: l.grower.profile?.orgName,
      certifications: l.certifications,
      photo: l.photos[0],
      url: `/marketplace/${l.slug}`,
    })),
  };
});

export const POST = handler({ auth: ["grower", "admin"], rateLimit: [30, 3600], name: "listing-create" }, async ({ req, user }) => {
  await assertCanAct(user);
  const data = await body(req, listingSchema);
  let ownerId = user.id;
  if (user.role === "admin") {
    if (!data.growerId) fail(422, "Choose the grower this listing is for.", { growerId: "Required" });
    const g = await db.user.findUnique({ where: { id: data.growerId! } });
    if (!g || g.role !== "grower") fail(422, "That grower wasn't found.", { growerId: "Not found" });
    ownerId = g!.id;
  }
  if (data.status !== "draft" && data.status !== "active") fail(422, "New listings start as draft or active.", { status: "Invalid" });
  await assertOwnedMedia(data.photos, [ownerId, user.id]);
  const owner = await db.user.findUniqueOrThrow({ where: { id: ownerId }, include: { profile: true } });
  if (data.regionId && !(await db.region.findUnique({ where: { id: data.regionId } }))) fail(422, "Unknown region.", { regionId: "Unknown region" });
  const regionId = data.regionId ?? owner.profile?.regionId ?? null;
  const region = regionId ? await db.region.findUnique({ where: { id: regionId } }) : null;
  const settings = await getSettings();
  const { growerId: _g, ...rest } = data;
  void _g;
  const listing = await db.listing.create({
    data: {
      ...rest,
      category: data.category as never,
      growerId: ownerId,
      slug: `${slugify(data.title)}-${randomSuffix(5)}`,
      lotCode: `AH-${(region?.slug ?? "ca").slice(0, 2).toUpperCase()}-${Date.now().toString(36).toUpperCase()}${randomSuffix(3).toUpperCase()}`,
      regionId: region?.id,
      lat: owner.profile?.lat ?? region?.lat,
      lng: owner.profile?.lng ?? region?.lng,
      certifications: owner.profile?.certifications ?? [],
      approval: user.role === "admin" ? "approved" : "pending",
    },
  });
  if (user.role === "admin") {
    await notify(ownerId, { type: "listing", title: "GRIS Canada created a listing for you", body: listing.title, link: `/dashboard/listings/${listing.id}/edit` });
    await audit(user.id, "listing.assisted_create", "listing", listing.id, { growerId: ownerId });
  } else {
    await notifyAdmins({ type: "review_listing", title: `New listing to review: ${listing.title}`, link: "/admin/approvals" });
  }
  if (listing.status === "active" && (settings.moderation === "post" || listing.approval === "approved")) await matchSavedSearches(listing.id);
  return { ok: true, id: listing.id, slug: listing.slug, approval: listing.approval, moderation: settings.moderation };
});
