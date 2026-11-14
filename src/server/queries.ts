import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { CATEGORIES, CERTIFICATIONS, DIRECTORY_TABS, PARTNER_ROLES, type RoleKey } from "@/lib/constants";
import { haversineKm } from "@/lib/utils";
import { visibleApproval } from "./settings";

export const listingCardInclude = {
  region: true,
  grower: { select: { id: true, isVerified: true, profile: { select: { orgName: true, slug: true, photoUrl: true, city: true } } } },
} satisfies Prisma.ListingInclude;

export type ListingCardData = Prisma.ListingGetPayload<{ include: typeof listingCardInclude }>;

export type ListingFilters = {
  q?: string;
  category?: string[];
  region?: string[];
  cert?: string[];
  season?: string; // now | upcoming
  minPrice?: number;
  maxPrice?: number;
  sort?: string; // newest | price_asc | price_desc | distance | harvest
  page?: number;
  growerId?: string;
  near?: { lat: number; lng: number };
};

export const PAGE_SIZE = 24;

export async function listingWhere(f: ListingFilters): Promise<Prisma.ListingWhereInput> {
  const now = new Date();
  const and: Prisma.ListingWhereInput[] = [{ status: "active" }, await visibleApproval(), { grower: { status: "active" } }];
  if (f.q) {
    const q = f.q.trim().slice(0, 80);
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { produce: { contains: q, mode: "insensitive" } },
        { variety: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { grower: { profile: { orgName: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  // ignore unknown values instead of letting them reach the DB
  const cats = (f.category ?? []).filter((c) => CATEGORIES.some((x) => x.key === c));
  const certs = (f.cert ?? []).filter((c) => CERTIFICATIONS.some((x) => x.key === c));
  const regions = (f.region ?? []).filter((r) => /^[a-z0-9-]{1,60}$/.test(r));
  if (cats.length) and.push({ category: { in: cats as Prisma.EnumProduceCategoryFilter["in"] } });
  if (regions.length) and.push({ region: { slug: { in: regions } } });
  if (certs.length) and.push({ certifications: { hasSome: certs } });
  if (f.minPrice != null) and.push({ price: { gte: f.minPrice } });
  if (f.maxPrice != null) and.push({ price: { lte: f.maxPrice } });
  if (f.season === "now") and.push({ OR: [{ harvestStart: null }, { harvestStart: { lte: now } }] }, { OR: [{ harvestEnd: null }, { harvestEnd: { gte: now } }] });
  if (f.season === "upcoming") and.push({ harvestStart: { gt: now } });
  if (f.growerId) and.push({ growerId: f.growerId });
  return { AND: and };
}

export async function searchListings(f: ListingFilters) {
  const where = await listingWhere(f);
  const page = Math.max(1, Math.floor(Number(f.page)) || 1);
  const total = await db.listing.count({ where });

  if (f.sort === "distance" && f.near) {
    // Distance sort: rank lightweight rows in memory, then hydrate the page.
    const rows = await db.listing.findMany({ where, select: { id: true, lat: true, lng: true } });
    const near = f.near;
    const ranked = rows
      .map((r) => ({ id: r.id, d: r.lat != null && r.lng != null ? haversineKm(near, { lat: r.lat, lng: r.lng }) : 1e9 }))
      .sort((a, b) => a.d - b.d)
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const items = await db.listing.findMany({ where: { id: { in: ranked.map((r) => r.id) } }, include: listingCardInclude });
    const byId = new Map(items.map((i) => [i.id, i]));
    return { items: ranked.map((r) => ({ ...byId.get(r.id)!, distanceKm: r.d < 1e9 ? r.d : null })), total, page, pages: Math.ceil(total / PAGE_SIZE) };
  }

  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    f.sort === "price_asc"
      ? [{ price: { sort: "asc", nulls: "last" } }]
      : f.sort === "price_desc"
        ? [{ price: { sort: "desc", nulls: "last" } }]
        : f.sort === "harvest"
          ? [{ harvestStart: { sort: "asc", nulls: "last" } }]
          : [{ isFeatured: "desc" }, { createdAt: "desc" }];
  const items = await db.listing.findMany({ where, include: listingCardInclude, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE });
  return {
    items: items.map((i) => ({ ...i, distanceKm: f.near && i.lat != null && i.lng != null ? haversineKm(f.near, { lat: i.lat, lng: i.lng }) : null })),
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
  };
}

export const profileCardSelect = {
  id: true,
  slug: true,
  orgName: true,
  tagline: true,
  photoUrl: true,
  city: true,
  certifications: true,
  specialties: true,
  isFeatured: true,
  lat: true,
  lng: true,
  region: { select: { name: true, slug: true } },
  user: { select: { id: true, role: true, isVerified: true } },
} satisfies Prisma.ProfileSelect;

export type ProfileCardData = Prisma.ProfileGetPayload<{ select: typeof profileCardSelect }>;

export async function searchDirectory(opts: { tab?: string; q?: string; region?: string; page?: number }) {
  const tab = DIRECTORY_TABS.find((t) => t.key === opts.tab) ?? DIRECTORY_TABS[0]!;
  const and: Prisma.ProfileWhereInput[] = [await visibleApproval(), { user: { status: "active", role: { not: "admin" } } }, { photoUrl: { not: null } }];
  if (tab.roles.length) and.push({ user: { role: { in: tab.roles } } });
  if (tab.buyerType) and.push({ buyerType: tab.buyerType });
  if (tab.notBuyerType) and.push({ OR: [{ buyerType: null }, { buyerType: { not: tab.notBuyerType } }] });
  if (tab.cert) and.push({ certifications: { has: tab.cert } });
  if (opts.region) and.push({ region: { slug: opts.region } });
  if (opts.q) {
    const q = opts.q.trim().slice(0, 80);
    and.push({ OR: [{ orgName: { contains: q, mode: "insensitive" } }, { bio: { contains: q, mode: "insensitive" } }, { tagline: { contains: q, mode: "insensitive" } }, { specialties: { has: q.toLowerCase() } }, { city: { contains: q, mode: "insensitive" } }, { buyBcProducts: { some: { name: { contains: q, mode: "insensitive" } } } }] });
  }
  const where = { AND: and };
  const page = Math.max(1, Math.floor(Number(opts.page)) || 1);
  const live = { photoUrl: { not: null }, user: { status: "active" as const } };
  const [items, total, counts, processors, buyers, buyBc] = await Promise.all([
    db.profile.findMany({ where, select: profileCardSelect, orderBy: [{ isFeatured: "desc" }, { isClaimed: "desc" }, { user: { isVerified: "desc" } }, { orgName: "asc" }], skip: (page - 1) * 36, take: 36 }),
    db.profile.count({ where }),
    db.user.groupBy({ by: ["role"], where: { status: "active", profile: { photoUrl: { not: null } } }, _count: true }),
    db.profile.count({ where: { buyerType: "processor", photoUrl: { not: null }, user: { status: "active", role: "buyer" } } }),
    db.profile.count({ where: { ...live, user: { status: "active", role: "buyer" }, OR: [{ buyerType: null }, { buyerType: { not: "processor" } }] } }),
    db.profile.count({ where: { ...live, certifications: { has: "buy_bc" } } }),
  ]);
  const roleCounts = Object.fromEntries(counts.map((c) => [c.role, c._count])) as Record<string, number>;
  const tabCounts = Object.fromEntries(
    DIRECTORY_TABS.map((t) => [
      t.key,
      t.cert ? buyBc : t.notBuyerType ? buyers : t.buyerType ? processors : t.roles.length ? t.roles.reduce((s, r) => s + (roleCounts[r] ?? 0), 0) : Object.entries(roleCounts).filter(([r]) => r !== "admin").reduce((s, [, n]) => s + n, 0),
    ]),
  );
  return { items, total, page, pages: Math.ceil(total / 36), tab: tab.key, tabCounts };
}

/** Live platform metrics used for admin KPIs, the public impact strip and auto KPI targets. */
export async function platformMetrics() {
  const since30 = new Date(Date.now() - 30 * 86400000);
  const [exportBuyers, byRole, listings, activeListings, inquiries, rfqsAccepted, demand, resources, events, posts, threads30] = await Promise.all([
    db.profile.count({ where: { buyerType: "export", user: { status: "active", role: "buyer" } } }),
    db.user.groupBy({ by: ["role"], _count: true, where: { status: "active", OR: [{ profile: { isClaimed: true } }, { profile: null }] } }),
    db.listing.count(),
    db.listing.count({ where: { status: "active", approval: { not: "rejected" } } }),
    db.thread.count(),
    db.rfq.count({ where: { status: "accepted" } }),
    db.demandPost.count({ where: { isOpen: true } }),
    db.resource.count({ where: { approval: "approved" } }),
    db.event.count({ where: { startsAt: { gte: new Date() } } }),
    db.post.count(),
    db.thread.count({ where: { createdAt: { gte: since30 } } }),
  ]);
  const roles = Object.fromEntries(byRole.map((r) => [r.role, r._count])) as Partial<Record<RoleKey, number>>;
  const partners = PARTNER_ROLES.reduce((s, r) => s + (roles[r] ?? 0), 0);
  return {
    roles,
    growers: roles.grower ?? 0,
    buyers: roles.buyer ?? 0,
    partners,
    export_buyers: exportBuyers,
    listings,
    activeListings,
    inquiries,
    transactions: rfqsAccepted,
    openDemand: demand,
    resources,
    upcomingEvents: events,
    posts,
    inquiries30: threads30,
  };
}

export type Metrics = Awaited<ReturnType<typeof platformMetrics>>;

/** Weekly counts of an activity type for one owner (grower/partner) or platform-wide. */
export async function weeklySeries(types: string[], weeks = 12, ownerId?: string) {
  const start = new Date(Date.now() - weeks * 7 * 86400000);
  const rows = await db.activityEvent.findMany({ where: { type: { in: types }, createdAt: { gte: start }, ...(ownerId ? { ownerId } : {}) }, select: { createdAt: true } });
  const buckets = Array.from({ length: weeks }, (_, i) => ({ label: new Date(start.getTime() + i * 7 * 86400000), value: 0 }));
  for (const r of rows) {
    const idx = Math.min(weeks - 1, Math.floor((r.createdAt.getTime() - start.getTime()) / (7 * 86400000)));
    if (idx >= 0) buckets[idx]!.value++;
  }
  return buckets;
}

export async function unreadCounts(userId: string) {
  const [notifications, parts] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    db.threadParticipant.findMany({ where: { userId }, select: { threadId: true, lastReadAt: true } }),
  ]);
  let messages = 0;
  if (parts.length) {
    const counts = await Promise.all(
      parts.map((p) => db.message.count({ where: { threadId: p.threadId, senderId: { not: userId }, ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}) } })),
    );
    messages = counts.filter((c) => c > 0).length;
  }
  return { notifications, messages };
}

/** Average rating and count for a user. */
export async function ratingFor(userId: string) {
  const r = await db.review.aggregate({ where: { subjectId: userId, isHidden: false }, _avg: { rating: true }, _count: true });
  return { avg: r._avg.rating, count: r._count };
}
