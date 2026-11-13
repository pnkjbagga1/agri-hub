import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { db } from "@/lib/db";
import { searchDirectory } from "@/server/queries";
import { ProfileCard } from "@/components/ProfileCard";
import { MapLoader } from "@/components/MapLoader";
import { ButtonLink, EmptyState, Pagination } from "@/components/ui";
import { DIRECTORY_TABS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Stakeholder directory", description: "Find BC growers, buyers, universities, consultants, EDC, FCC, government programs, ag-tech, suppliers and dealers." };

type SP = { tab?: string; q?: string; region?: string; page?: string; view?: string };

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [r, regions] = await Promise.all([searchDirectory({ tab: sp.tab, q: sp.q, region: sp.region, page: Number(sp.page ?? 1) || 1 }), db.region.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })]);
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    if (!("page" in patch)) p.delete("page");
    return `/directory?${p}`;
  };
  return (
    <div className="container-page py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-leaf!">Stakeholder directory</p>
          <h1 className="mt-2 text-3xl sm:text-[2.6rem]">Every door in BC agri-food</h1>
          <p className="mt-2 max-w-2xl text-muted">Find and connect with growers, buyers, universities, experts, financing partners, government programs, suppliers and dealers.</p>
        </div>
        <ButtonLink href="/signup" variant="gold">
          List your organisation
        </ButtonLink>
      </div>
      <form className="mb-5 flex flex-wrap gap-3" role="search">
        {sp.tab && <input type="hidden" name="tab" value={sp.tab} />}
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={sp.q} className="input h-12 rounded-full! pl-12" placeholder="Search organisations, services, crops, cities…" aria-label="Search directory" />
        </div>
        <select name="region" defaultValue={sp.region ?? ""} className="input h-12 w-auto rounded-full!" aria-label="Region">
          <option value="">All regions</option>
          {regions.map((x) => (
            <option key={x.id} value={x.slug}>
              {x.name}
            </option>
          ))}
        </select>
        <button className="h-12 rounded-full bg-primary px-6 font-semibold text-white hover:bg-leaf">Search</button>
      </form>
      <nav className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-2" aria-label="Stakeholder types">
        {DIRECTORY_TABS.map((t) => (
          <Link key={t.key} href={qs({ tab: t.key === "all" ? undefined : t.key })} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap ring-1 ring-inset", r.tab === t.key ? "bg-primary text-white ring-primary" : "bg-white ring-line hover:ring-primary/40")} aria-current={r.tab === t.key ? "page" : undefined}>
            {t.label} <span className={r.tab === t.key ? "text-white/70" : "text-muted"}>{r.tabCounts[t.key] ?? 0}</span>
          </Link>
        ))}
        <Link href={qs({ view: sp.view === "map" ? undefined : "map" })} className="ml-auto shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-line ring-inset">
          {sp.view === "map" ? "Grid view" : "Map view"}
        </Link>
      </nav>
      {r.items.length === 0 ? (
        <EmptyState icon={<Users className="size-7" />} title="No organisations found" body="Try another tab or search term." />
      ) : sp.view === "map" ? (
        <MapLoader points={r.items.filter((p) => p.lat != null && p.lng != null).map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, title: p.orgName, subtitle: p.tagline ?? undefined, href: `/directory/${p.slug}`, image: p.photoUrl }))} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {r.items.map((p) => (
            <ProfileCard key={p.id} p={p} />
          ))}
        </div>
      )}
      <Pagination page={r.page} pages={r.pages} hrefFor={(n) => qs({ page: String(n) })} />
    </div>
  );
}
