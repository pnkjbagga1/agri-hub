import { db } from "@/lib/db";
import { ListingForm } from "@/components/listings/ListingForm";
import { EMPTY_LISTING } from "@/components/listings/listing-defaults";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Assisted listing" };

export default async function AssistedListingPage() {
  const [regions, growers] = await Promise.all([
    db.region.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { role: "grower", status: "active" }, select: { id: true, profile: { select: { orgName: true, city: true } } }, orderBy: { profile: { orgName: "asc" } } }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Assisted entry" title="Create a listing for a grower" subtitle="For growers who prefer phone or in-person intake during the pilot. The listing is published as approved and the grower is notified." />
      <ListingForm initial={EMPTY_LISTING} regions={regions} certifications={[]} growers={growers.map((g) => ({ id: g.id, name: `${g.profile?.orgName ?? g.id}${g.profile?.city ? ` — ${g.profile.city}` : ""}` }))} />
    </>
  );
}
