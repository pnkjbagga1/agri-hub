import type { Metadata } from "next";
import { Suspense } from "react";
import { Sprout } from "lucide-react";
import { db } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { searchListings } from "@/server/queries";
import { FilterPanel, SearchSortBar } from "@/components/listings/BrowseFilters";
import { ListingGrid } from "@/components/listings/ListingCard";
import { MapLoader } from "@/components/MapLoader";
import { ButtonLink, EmptyState, Pagination } from "@/components/ui";

export const metadata: Metadata = { title: "Marketplace — fresh BC produce", description: "Browse fresh produce from BC growers: berries, greenhouse vegetables, tree fruit and more. Filter by region, category, certification and harvest window." };

type SP = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await getSessionUser();
  const regions = await db.region.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } });
  const near = user?.profile?.lat != null && user.profile.lng != null ? { lat: user.profile.lat, lng: user.profile.lng } : { lat: 49.0504, lng: -122.3045 }; // default: Abbotsford
  const view = sp.view === "map" ? "map" : "grid";
  const result = await searchListings({
    q: typeof sp.q === "string" ? sp.q : undefined,
    category: arr(sp.category),
    region: arr(sp.region),
    cert: arr(sp.cert),
    season: typeof sp.season === "string" ? sp.season : undefined,
    sort: typeof sp.sort === "string" ? sp.sort : undefined,
    page: Number(sp.page ?? 1) || 1,
    near,
  });
  const hrefFor = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) arr(v).forEach((x) => q.append(k, x));
    q.set("page", String(p));
    return `/marketplace?${q}`;
  };
  const points = result.items.filter((l) => l.lat != null && l.lng != null).map((l) => ({ id: l.id, lat: l.lat!, lng: l.lng!, title: l.title, subtitle: `${l.grower.profile?.orgName} · ${l.region?.name ?? ""}`, href: `/marketplace/${l.slug}`, image: l.photos[0] }));

  return (
    <div className="container-page py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-leaf!">Marketplace</p>
          <h1 className="mt-2 text-3xl sm:text-[2.6rem]">Fresh produce listings</h1>
          <p className="mt-2 text-muted">Direct from BC growers{user?.profile?.region ? ` · distances from ${user.profile.region.name}` : " · distances from Abbotsford, BC"}.</p>
        </div>
        {(user?.role === "grower" || !user) && (
          <ButtonLink href="/dashboard/listings/new" variant="gold">
            <Sprout className="size-4" /> List your produce
          </ButtonLink>
        )}
      </div>
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <Suspense>
          <FilterPanel regions={regions} />
        </Suspense>
        <div className="min-w-0">
          <Suspense>
            <SearchSortBar total={result.total} signedIn={!!user} />
          </Suspense>
          {result.items.length === 0 ? (
            <EmptyState icon={<Sprout className="size-7" />} title="No listings match those filters" body="Try widening the region or category — or post what you need on the demand board so growers can come to you." action={<ButtonLink href="/demand">Go to the demand board</ButtonLink>} />
          ) : view === "map" ? (
            <MapLoader points={points} />
          ) : (
            <ListingGrid items={result.items} />
          )}
          <Pagination page={result.page} pages={result.pages} hrefFor={hrefFor} />
        </div>
      </div>
    </div>
  );
}
