import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireRole } from "@/server/guards";
import { DemandForm } from "@/components/forms/Posting";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Post a need" };

export default async function NewDemandPage() {
  await requireRole(["buyer"]);
  const regions = await db.region.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader eyebrow="Buyer" title="Post what you need" subtitle="One-time, weekly or seasonal contracts — growers plan plantings against real demand." />
      <DemandForm regions={regions} />
    </>
  );
}
