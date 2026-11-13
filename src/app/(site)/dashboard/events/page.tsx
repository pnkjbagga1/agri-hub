import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/server/guards";
import { DeleteButton } from "@/components/DashboardBits";
import { ButtonLink, EmptyState, PageHeader, Pill } from "@/components/ui";
import { EVENT_LABEL, PARTNER_ROLES } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "My events" };

export default async function MyEventsPage() {
  const user = await requireRole(PARTNER_ROLES);
  const events = await db.event.findMany({ where: { hostProfileId: user.profile!.id }, include: { _count: { select: { rsvps: true } } }, orderBy: { startsAt: "desc" } });
  return (
    <>
      <PageHeader eyebrow="Partner" title="Events" subtitle="Webinars, workshops, farm tours and trade shows." actions={<ButtonLink href="/dashboard/events/new" variant="gold">Host an event</ButtonLink>} />
      {events.length === 0 ? (
        <EmptyState icon={<CalendarDays className="size-7" />} title="No events yet" action={<ButtonLink href="/dashboard/events/new">Host your first event</ButtonLink>} />
      ) : (
        <ul className="card divide-y divide-line">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/events/${e.id}`} className="font-semibold hover:text-leaf">
                  {e.title}
                </Link>
                <p className="text-sm text-muted">
                  {EVENT_LABEL[e.type]} · {formatDateTime(e.startsAt)}
                </p>
              </div>
              <Pill tone="gold">{e._count.rsvps} RSVPs</Pill>
              <Pill tone={e.approval === "approved" ? "green" : e.approval === "rejected" ? "red" : "neutral"}>{e.approval === "pending" ? "in review" : e.approval}</Pill>
              <DeleteButton path={`/events/${e.id}`} confirmText="Delete this event?" />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
