import type { Metadata } from "next";
import { Sprout } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/server/guards";
import { ListingsTable } from "@/components/listings/ListingsTable";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "My listings" };

export default async function MyListingsPage() {
  const user = await requireRole(["grower"]);
  const listings = await db.listing.findMany({ where: { growerId: user.id, status: { not: "archived" } }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { threads: true, rfqs: true } } } });
  return (
    <>
      <PageHeader eyebrow="Grower" title="My listings" subtitle="Pause, resume, mark sold out or edit. Archived listings keep their traceability pages." actions={<ButtonLink href="/dashboard/listings/new" variant="gold"><Sprout className="size-4" /> Add listing</ButtonLink>} />
      {listings.length === 0 ? (
        <EmptyState icon={<Sprout className="size-7" />} title="No listings yet" body="List what you grow with photos, volume and harvest window — buyers across BC will find you." action={<ButtonLink href="/dashboard/listings/new">Create your first listing</ButtonLink>} />
      ) : (
        <div className="card overflow-hidden">
          <ListingsTable rows={listings.map((l) => ({ id: l.id, slug: l.slug, title: l.title, photo: l.photos[0] ?? null, volume: `${formatNumber(l.volume)} ${l.unit}`, status: l.status, approval: l.approval, inquiries: l._count.threads, rfqs: l._count.rfqs }))} />
        </div>
      )}
    </>
  );
}
