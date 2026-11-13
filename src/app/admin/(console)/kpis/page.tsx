import { db } from "@/lib/db";
import { KpiEditor } from "@/components/admin/AdminActions";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "KPI targets" };

export default async function KpisPage() {
  const kpis = await db.kpiTarget.findMany({ orderBy: [{ group: "asc" }, { sortOrder: "asc" }] });
  return (
    <>
      <PageHeader eyebrow="Targets" title="KPI targets" subtitle="Configurable targets from the GRIS Canada Action Plan and MVP strategy. Metrics marked “live” are counted from the database; enter others (e.g. incubator graduates, BC import dependence) manually as the physical hub roadmap progresses." />
      <KpiEditor items={kpis} />
    </>
  );
}
