import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { BarList } from "@/components/charts";
import { PageHeader, Pagination, StatCard, EmptyState } from "@/components/ui";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Buy BC licensed products — 10,000+ BC food & beverage products",
  description: "Search every Buy BC licensed product and the BC farms, processors and food businesses behind them. Source: Province of BC, as of March 3, 2025.",
};

const PER_PAGE = 50;

export default async function BuyBcPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 80) || undefined;
  const q = one(sp.q);
  const cat = one(sp.category);
  const page = Math.max(1, Math.floor(Number(one(sp.page))) || 1);

  const byCat = await db.buyBcProduct.groupBy({ by: ["category"], _count: { _all: true }, orderBy: { _count: { category: "desc" } } });
  const categories = byCat.map((c) => c.category);
  const category = cat && categories.includes(cat) ? cat : undefined;

  const where: Prisma.BuyBcProductWhereInput = {
    ...(category ? { category } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { profile: { orgName: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const [total, orgCount, items, matchCount] = await Promise.all([
    db.buyBcProduct.count(),
    db.profile.count({ where: { buyBcProducts: { some: {} } } }),
    db.buyBcProduct.findMany({ where, orderBy: [{ profile: { orgName: "asc" } }, { name: "asc" }], skip: (page - 1) * PER_PAGE, take: PER_PAGE, select: { id: true, name: true, category: true, profile: { select: { orgName: true, slug: true } } } }),
    db.buyBcProduct.count({ where }),
  ]);
  const perOrg = await db.buyBcProduct.groupBy({ by: ["profileId"], _count: { _all: true } });
  const counts = perOrg.map((r) => r._count._all).sort((a, b) => a - b);
  const median = counts.length ? counts[Math.floor((counts.length - 1) / 2)]! : 0;
  const single = counts.filter((n) => n === 1).length;
  const pages = Math.max(1, Math.ceil(matchCount / PER_PAGE));
  const href = (p: number, c = category) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (c) u.set("category", c);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return `/buy-bc${s ? `?${s}` : ""}`;
  };

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Buy BC"
        title="Buy BC licensed products"
        subtitle="Every product licensed to carry the Buy BC logo, and the BC farms, processors and food businesses that make them. Find a supplier, then message them or claim your profile."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Licensed products" value={formatNumber(total)} />
        <StatCard label="Organisations" value={formatNumber(orgCount)} tone="gold" />
        <StatCard label="Product categories" value={byCat.length} tone="blue" />
        <StatCard label="Avg / median per org" value={`${orgCount ? (total / orgCount).toFixed(1) : 0} / ${median}`} hint={`${single} orgs with 1 product`} tone="ink" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[320px_1fr]">
        <aside className="min-w-0 space-y-6">
          <div className="card p-5">
            <h2 className="text-lg">Products by category</h2>
            <div className="mt-4">
              <BarList rows={byCat.map((c) => ({ label: c.category, value: c._count._all }))} />
            </div>
          </div>
          <p className="text-xs text-muted">
            Source: Province of BC, &ldquo;Buy BC Licensed Products and Categories&rdquo; list, as of March 3, 2025. Businesses are listed as unclaimed directory entries until they claim their profile.
          </p>
        </aside>

        <section className="min-w-0">
          <form action="/buy-bc" className="flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Search products or businesses</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
              <input name="q" defaultValue={q} placeholder="Search products or businesses — e.g. blueberry, cider, Earth Apple Farm" className="input w-full pl-10" />
            </label>
            <select name="category" defaultValue={category ?? ""} className="input sm:w-64" aria-label="Category">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button className="rounded-full bg-primary px-6 py-3 font-semibold text-white">Search</button>
          </form>
          <p className="mt-4 text-sm text-muted">
            {formatNumber(matchCount)} product{matchCount === 1 ? "" : "s"}
            {category ? ` in ${category}` : ""}
            {q ? ` matching “${q}”` : ""}
          </p>
          {items.length === 0 ? (
            <div className="mt-6">
              <EmptyState title="No products found" body="Try a different word or clear the category filter." />
            </div>
          ) : (
            <div className="card mt-4 overflow-hidden">
              <ul className="divide-y divide-line">
                {items.map((it) => (
                  <li key={it.id} className="flex flex-col gap-1 px-5 py-3 lg:flex-row lg:items-center lg:gap-4">
                    <span className="min-w-0 flex-1 font-semibold break-words">{it.name}</span>
                    <Link href={`/directory/${it.profile.slug}#buy-bc`} className="min-w-0 text-sm text-leaf hover:underline lg:w-56 lg:truncate">
                      {it.profile.orgName}
                    </Link>
                    <Link href={href(1, it.category)} className="text-xs text-muted hover:text-ink lg:w-40 lg:text-right">
                      {it.category}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-6">
            <Pagination page={page} pages={pages} hrefFor={(p) => href(p)} />
          </div>
        </section>
      </div>
    </div>
  );
}
