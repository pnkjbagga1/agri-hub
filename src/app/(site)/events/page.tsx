import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin, Video } from "lucide-react";
import { db } from "@/lib/db";
import { ButtonLink, EmptyState, Pill } from "@/components/ui";
import { EVENT_LABEL } from "@/lib/constants";
import { asset } from "@/lib/paths";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Events — webinars, farm tours & trade shows", description: "Upcoming agri-food events from GRIS Canada and partners, including the Agri Innovation Challenge and AgriFest Canada." };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ past?: string }> }) {
  const { past } = await searchParams;
  const now = new Date();
  const events = await db.event.findMany({
    where: { approval: "approved", startsAt: past ? { lt: now } : { gte: now } },
    include: { host: { select: { orgName: true, slug: true } }, _count: { select: { rsvps: true } } },
    orderBy: { startsAt: past ? "desc" : "asc" },
  });
  return (
    <div className="container-page py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-leaf!">Events</p>
          <h1 className="mt-2 text-3xl sm:text-[2.6rem]">{past ? "Past events" : "Upcoming events"}</h1>
          <p className="mt-2 text-muted">Webinars, farm tours, workshops and trade shows across the GRIS Canada network.</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href={past ? "/events" : "/events?past=1"} variant="outline">
            {past ? "Upcoming" : "Past events"}
          </ButtonLink>
          <ButtonLink href="/dashboard/events/new" variant="gold">
            Host an event
          </ButtonLink>
        </div>
      </div>
      {events.length === 0 ? (
        <EmptyState icon={<CalendarDays className="size-7" />} title="No events here yet" />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
              <div className="relative h-36 bg-sand" style={e.coverUrl ? { backgroundImage: `url(${asset(e.coverUrl)})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                <div className="absolute top-3 left-3 grid size-14 place-items-center rounded-xl bg-white text-center shadow">
                  <span className="text-[11px] font-bold text-danger uppercase">{e.dateNote ? "Date" : formatDate(e.startsAt, { month: "short", timeZone: e.timeZone })}</span>
                  <span className={e.dateNote ? "-mt-1 text-sm font-black" : "-mt-2 text-xl font-black"}>{e.dateNote ? "TBA" : formatDate(e.startsAt, { day: "numeric", timeZone: e.timeZone })}</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <Pill tone="green" className="self-start">
                  {EVENT_LABEL[e.type]}
                </Pill>
                <h2 className="mt-2 text-lg leading-snug">{e.title}</h2>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
                  {e.onlineUrl && !e.location ? <Video className="size-4" /> : <MapPin className="size-4" />} {e.location ?? "Online"}
                </p>
                <p className="mt-auto pt-4 text-xs text-muted">
                  {e.host?.orgName ?? "GRIS Canada"} · {e._count.rsvps} attending
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
