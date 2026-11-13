import type { Metadata } from "next";
import { db } from "@/lib/db";
import { platformMetrics, weeklySeries } from "@/server/queries";
import { BarList, LineChart } from "@/components/charts";
import { StatCard } from "@/components/ui";
import { CATEGORY_LABEL } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Market insights — BC produce prices, supply & demand", description: "Live price discovery and supply/demand signals from AGRI HUB listings, quotes and buyer demand across BC regions." };

export default async function InsightsPage() {
  const [listings, demand, quotes, metrics, signups, inquiries] = await Promise.all([
    db.listing.findMany({ where: { status: "active", approval: { not: "rejected" } }, select: { produce: true, category: true, price: true, priceUnit: true, unit: true, volume: true, region: { select: { name: true } } } }),
    db.demandPost.findMany({ where: { isOpen: true, approval: { not: "rejected" } }, select: { category: true, quantity: true, unit: true } }),
    db.rfq.findMany({ where: { status: { in: ["quoted", "accepted"] }, quotePrice: { not: null } }, select: { quotePrice: true, unit: true, listing: { select: { produce: true } } } }),
    platformMetrics(),
    weeklySeries(["signup"], 12),
    weeklySeries(["inquiry", "rfq"], 12),
  ]);
  // Price index: average asking price per kg by produce (listings priced per kg/lb)
  const perKg = new Map<string, { sum: number; n: number }>();
  for (const l of listings) {
    if (l.price == null) continue;
    const u = l.priceUnit ?? l.unit;
    const kg = u === "kg" ? l.price : u === "lb" ? l.price / 0.4536 : null;
    if (kg == null) continue;
    const e = perKg.get(l.produce) ?? { sum: 0, n: 0 };
    e.sum += kg;
    e.n += 1;
    perKg.set(l.produce, e);
  }
  const priceRows = [...perKg.entries()].map(([label, v]) => ({ label, value: Math.round((v.sum / v.n) * 100) / 100 })).sort((a, b) => b.value - a.value);
  const byRegion = new Map<string, number>();
  for (const l of listings) byRegion.set(l.region?.name ?? "Other", (byRegion.get(l.region?.name ?? "Other") ?? 0) + 1);
  const supplyCat = new Map<string, number>();
  for (const l of listings) supplyCat.set(l.category, (supplyCat.get(l.category) ?? 0) + 1);
  const demandCat = new Map<string, number>();
  for (const d of demand) demandCat.set(d.category, (demandCat.get(d.category) ?? 0) + 1);
  const cats = [...new Set([...supplyCat.keys(), ...demandCat.keys()])];
  const quoteRows = quotes.filter((q) => q.listing && (q.unit === "kg" || q.unit === "lb")).map((q) => ({ label: `${q.listing!.produce} (accepted/quoted)`, value: q.unit === "lb" ? q.quotePrice! / 0.4536 : q.quotePrice! }));

  return (
    <div className="container-page py-10">
      <p className="eyebrow text-leaf!">Price discovery & demand signals</p>
      <h1 className="mt-2 text-3xl sm:text-[2.6rem]">Market insights</h1>
      <p className="mt-2 max-w-2xl text-muted">Live, anonymised signals from AGRI HUB listings, quotes and buyer demand — so growers can plan plantings against real demand and funders can see the sector move.</p>
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active listings" value={metrics.activeListings} />
        <StatCard label="Open buyer requests" value={metrics.openDemand} tone="gold" />
        <StatCard label="Connections made" value={metrics.inquiries} tone="blue" />
        <StatCard label="Deals agreed" value={metrics.transactions} tone="ink" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-lg">Asking price index (CAD / kg)</h2>
          <p className="mb-4 text-sm text-muted">Average asking price on active listings priced by weight.</p>
          <BarList rows={priceRows} color="#1e7a3c" />
          {quoteRows.length > 0 && (
            <>
              <h3 className="mt-6 mb-3 text-base">Recent quotes</h3>
              <BarList rows={quoteRows.map((q) => ({ ...q, value: Math.round(q.value * 100) / 100 }))} color="#bc8a2e" />
            </>
          )}
        </section>
        <section className="card p-6">
          <h2 className="text-lg">Supply vs demand by category</h2>
          <p className="mb-4 text-sm text-muted">Active listings vs open buyer requests.</p>
          <table className="w-full text-[15px]">
            <thead className="text-xs text-muted uppercase">
              <tr>
                <th className="py-2 text-left">Category</th>
                <th className="py-2 text-right">Listings</th>
                <th className="py-2 text-right">Buyer requests</th>
                <th className="py-2 text-right">Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {cats.map((c) => {
                const s = supplyCat.get(c) ?? 0;
                const d = demandCat.get(c) ?? 0;
                return (
                  <tr key={c}>
                    <td className="py-2 font-semibold">{CATEGORY_LABEL[c]}</td>
                    <td className="py-2 text-right tabular-nums">{s}</td>
                    <td className="py-2 text-right tabular-nums">{d}</td>
                    <td className="py-2 text-right text-xs font-bold">{d > s ? <span className="text-danger">Undersupplied</span> : d === 0 ? <span className="text-muted">—</span> : <span className="text-leaf">Covered</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section className="card p-6">
          <h2 className="text-lg">Listings by region</h2>
          <div className="mt-4">
            <BarList rows={[...byRegion.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)} />
          </div>
        </section>
        <section className="card p-6">
          <h2 className="text-lg">Platform momentum</h2>
          <p className="mb-4 text-sm text-muted">Weekly new members and buyer inquiries (12 weeks).</p>
          <LineChart
            ariaLabel="Weekly signups and inquiries"
            series={[
              { name: "New members", color: "#0c3520", points: signups },
              { name: "Inquiries & RFQs", color: "#bc8a2e", points: inquiries },
            ]}
          />
        </section>
      </div>
      <section className="mt-6 rounded-[18px] bg-primary p-8 text-white">
        <p className="eyebrow">The bigger picture</p>
        <div className="mt-4 grid gap-6 sm:grid-cols-4">
          {[
            ["77.1%", "of BC's vegetable supply is imported"],
            ["2.7%", "of BC land can grow a wide range of crops"],
            ["$635M+", "Abbotsford annual farm-gate receipts"],
            ["1,282", "farms in Abbotsford · 72% of land in the ALR"],
          ].map(([v, l]) => (
            <div key={v}>
              <p className="font-display text-3xl font-black text-gold-soft">{v}</p>
              <p className="mt-1 text-sm text-white/75">{l}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-white/55">Sources: CAPI (2023); AAFC & Statistics Canada; City of Abbotsford agricultural land-use inventory. Volume on AGRI HUB: {formatNumber(listings.reduce((s, l) => s + (l.unit === "kg" ? l.volume : l.unit === "tonne" ? l.volume * 1000 : 0), 0))} kg currently listed by weight.</p>
      </section>
    </div>
  );
}
