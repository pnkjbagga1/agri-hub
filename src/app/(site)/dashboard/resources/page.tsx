import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/server/guards";
import { DeleteButton } from "@/components/DashboardBits";
import { ButtonLink, EmptyState, PageHeader, Pill } from "@/components/ui";
import { PARTNER_ROLES, RESOURCE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Programs & offers" };

export default async function MyResourcesPage() {
  const user = await requireRole(PARTNER_ROLES);
  const items = await db.resource.findMany({ where: { profileId: user.profile!.id }, include: { _count: { select: { interests: true } } }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader eyebrow="Partner" title="Programs & offers" subtitle="Grants, financing, courses, research calls, demos and services. Reviewed by GRIS Canada before going live." actions={<ButtonLink href="/dashboard/resources/new" variant="gold">Post a program</ButtonLink>} />
      {items.length === 0 ? (
        <EmptyState icon={<ClipboardList className="size-7" />} title="No programs yet" action={<ButtonLink href="/dashboard/resources/new">Post your first program</ButtonLink>} />
      ) : (
        <ul className="card divide-y divide-line">
          {items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/resources/${r.id}`} className="font-semibold hover:text-leaf">
                  {r.title}
                </Link>
                <p className="text-sm text-muted">
                  {RESOURCE_LABEL[r.type]}
                  {r.deadline && ` · deadline ${formatDate(r.deadline)}`}
                </p>
              </div>
              <Pill tone="gold">{r._count.interests} leads</Pill>
              <Pill tone={r.approval === "approved" ? "green" : r.approval === "rejected" ? "red" : "neutral"}>{r.approval === "pending" ? "in review" : r.approval}</Pill>
              <Link href={`/dashboard/resources/${r.id}/edit`} className="text-sm font-semibold text-leaf hover:underline">
                Edit
              </Link>
              <DeleteButton path={`/resources/${r.id}`} confirmText="Delete this program and its leads?" />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
