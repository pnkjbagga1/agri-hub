import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/server/guards";
import { ListingForm } from "@/components/listings/ListingForm";
import { Notice, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Edit listing" };

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["grower"]);
  const { id } = await params;
  const l = await db.listing.findUnique({ where: { id } });
  if (!l || l.growerId !== user.id) notFound();
  const regions = await db.region.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader eyebrow={`Lot ${l.lotCode}`} title="Edit listing" />
      {l.approval === "rejected" && <Notice tone="error" className="mb-6">Not approved{l.rejectionReason ? `: ${l.rejectionReason}` : ""}. Saving your changes resubmits it for review.</Notice>}
      <ListingForm initial={{ ...l, harvestStart: iso(l.harvestStart), harvestEnd: iso(l.harvestEnd), status: l.status }} regions={regions} certifications={user.profile?.certifications ?? []} />
    </>
  );
}
