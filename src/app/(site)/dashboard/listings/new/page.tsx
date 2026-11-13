import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireRole } from "@/server/guards";
import { ListingForm } from "@/components/listings/ListingForm";
import { EMPTY_LISTING } from "@/components/listings/listing-defaults";
import { Notice, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Add a produce listing" };

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireRole(["grower"]);
  const { welcome } = await searchParams;
  const regions = await db.region.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader eyebrow="Grower" title="Add new produce listing" subtitle="Takes about 2 minutes on your phone. Add real photos — they're the #1 driver of buyer inquiries." />
      {welcome && <Notice tone="success" className="mb-6">Profile complete — welcome to AGRI HUB! Now list your first product.</Notice>}
      <ListingForm initial={{ ...EMPTY_LISTING, regionId: user.profile?.regionId ?? null, pickupLocation: user.profile?.city ? `${user.profile.orgName}, ${user.profile.city}` : null }} regions={regions} certifications={user.profile?.certifications ?? []} />
    </>
  );
}
