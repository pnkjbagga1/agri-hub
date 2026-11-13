import Link from "next/link";
import { db } from "@/lib/db";
import { platformMetrics, weeklySeries, type Metrics } from "@/server/queries";
import { BarList, LineChart } from "@/components/charts";
import { PageHeader, Progress, StatCard } from "@/components/ui";
import { CATEGORY_LABEL, ROLE_LABELS, type RoleKey } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Overview" };

function current(k: { metric: string | null; currentValue: number | null }, m: Metrics) {
  if (k.metric && k.metric in m) return Number(m[k.metric as keyof Metrics]) || 0;
  return k.currentValue ?? 0;
}

export default async function AdminOverview() {
  const [m, kpis, signups, inquiries, transactions, byCategory, byRegion] = await Promise.all([
    platformMetrics(),
    db.kpiTarget.findMany({ orderBy: [{ group: "asc" }, { sortOrder: "asc" }] }),
    weeklySeries(["signup"], 12),
    weeklySeries(["inquiry", "rfq"], 12),
    weeklySeries(["transaction"], 12),
    db.listing.groupBy({ by: ["category"], where: { status: "active" }, _count: true }),
    db.listing.findMany({ where: { status: "active" }, select: { region: { select: { name: true } } } }),
  ]);
  const regionCounts = new Map<string, number>();
  for (const l of byRegion) regionCounts.set(l.region?.name ?? "Other", (regionCounts.get(l.region?.name ?? "Other") ?? 0) + 1);
  const groups: { key: string; title: string }[] = [
    { key: "traction_90", title: "90-day traction goals" },
    { key: "traction_180", title: "180-day traction goals" },
    { key: "five_year", title: "5-year GRIS Canada targets" },
  ];
  return (
    <>
      <PageHeader eyebrow="Admin" title="Platform overview" subtitle="Live KPIs from the database, tracked against the configurable targets from the GRIS Canada Action Plan." actions={<Link href="/admin/kpis" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-line">Edit targets</Link>} />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        <StatCard label="Growers" value={m.growers} />
        <StatCard label="Buyers" value={m.buyers} tone="gold" />
        <StatCard label="Partners" value={m.partners} tone="blue" />
        <StatCard label="Active listings" value={m.activeListings} />
        <StatCard label="Connections" value={m.inquiries} hint={`${m.inquiries30} in last 30 days`} tone="gold" />
        <StatCard label="Deals agreed" value={m.transactions} tone="ink" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {groups.map((g) => (
          <section key={g.key} className="card p-6">
            <h2 className="mb-4 text-lg">{g.title}</h2>
            <ul className="space-y-4">
              {kpis
                .filter((k) => k.group === g.key)
                .map((k) => {
                  const cur = current(k, m);
                  const inverse = k.key === "import_dependence"; // lower is better
                  const progress = inverse && k.baseline ? Math.max(0, ((k.baseline - cur) / (k.baseline - k.targetValue)) * 100) : (cur / k.targetValue) * 100;
                  return (
                    <li key={k.key}>
                      <div className="mb-1 flex justify-between gap-3 text-sm">
                        <span className="font-semibold">{k.label}</span>
                        <span className="text-muted tabular-nums">
                          {formatNumber(cur)}
                          {k.unit === "%" ? "%" : ""} / {k.targetLabel ?? formatNumber(k.targetValue)}
                        </span>
                      </div>
                      <Progress value={progress} max={100} tone={progress >= 100 ? "primary" : "gold"} />
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-lg">Growth & activity (12 weeks)</h2>
          <LineChart
            ariaLabel="Weekly signups, inquiries and deals"
            series={[
              { name: "Sign-ups", color: "#0c3520", points: signups },
              { name: "Inquiries & RFQs", color: "#bc8a2e", points: inquiries },
              { name: "Deals", color: "#c8102e", points: transactions },
            ]}
          />
        </section>
        <section className="card p-6">
          <h2 className="mb-4 text-lg">Registrations by role</h2>
          <BarList rows={Object.entries(m.roles).filter(([r]) => r !== "admin").map(([r, n]) => ({ label: ROLE_LABELS[r as RoleKey] ?? r, value: n ?? 0 })).sort((a, b) => b.value - a.value)} />
        </section>
        <section className="card p-6">
          <h2 className="mb-4 text-lg">Top categories (active listings)</h2>
          <BarList rows={byCategory.map((c) => ({ label: CATEGORY_LABEL[c.category] ?? c.category, value: c._count })).sort((a, b) => b.value - a.value)} color="#1e7a3c" />
        </section>
        <section className="card p-6">
          <h2 className="mb-4 text-lg">Top regions (active listings)</h2>
          <BarList rows={[...regionCounts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)} color="#bc8a2e" />
        </section>
      </div>
    </>
  );
}
