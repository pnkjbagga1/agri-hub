import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Users, Video } from "lucide-react";
import { db } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { RsvpButton } from "@/components/actions";
import { Avatar, Notice, Pill } from "@/components/ui";
import { EVENT_LABEL } from "@/lib/constants";
import { asset } from "@/lib/paths";
import { eventWhen } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const e = await db.event.findUnique({ where: { id }, select: { title: true, description: true, approval: true, coverUrl: true, posterUrl: true } });
  if (!e || e.approval !== "approved") return { title: "Event" };
  const image = e.posterUrl ?? e.coverUrl;
  return { title: e.title, description: e.description.slice(0, 200), openGraph: image ? { images: [asset(image)] } : undefined };
}

export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const e = await db.event.findUnique({ where: { id }, include: { host: true, rsvps: { take: 12, include: { user: { select: { profile: { select: { orgName: true, photoUrl: true, slug: true } } } } } }, _count: { select: { rsvps: true } } } });
  const own = !!user && e?.host?.userId === user.id;
  if (!e || (e.approval !== "approved" && !own && user?.role !== "admin")) notFound();
  const going = user ? await db.eventRsvp.findUnique({ where: { eventId_userId: { eventId: e.id, userId: user.id } } }) : null;
  const past = !e.dateNote && e.startsAt < new Date();
  const when = eventWhen(e);
  return (
    <div>
      {/* Banner keeps a fixed wide aspect (and max width) so text-bearing banners are never cropped */}
      <div className="bg-primary">
        <div className="relative mx-auto aspect-[1632/583] max-w-[1320px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {e.coverUrl && <img src={asset(e.coverUrl)} alt={`${e.title} banner`} className="absolute inset-0 size-full object-cover object-[center_30%]" />}
        </div>
      </div>
      <div className="container-page grid max-w-6xl gap-8 py-10 lg:grid-cols-[1fr_340px]">
        <div>
          <Link href="/events" className="tap text-sm font-semibold text-leaf hover:underline">
            ← All events
          </Link>
          {e.approval !== "approved" && <Notice tone="warn" className="mt-4">Status: {e.approval} — visible to you and moderators only.</Notice>}
          <div className="mt-2">
            <Pill tone="green">{EVENT_LABEL[e.type]}</Pill>
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl">{e.title}</h1>
          <p className="mt-6 leading-relaxed whitespace-pre-line text-ink-soft">{e.description}</p>
          {e.posterUrl && (
            <section className="mt-10">
              <h2 className="mb-3 text-lg">Event poster</h2>
              <a href={asset(e.posterUrl)} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-[18px] ring-1 ring-line transition hover:shadow-[var(--shadow-lift)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset(e.posterUrl)} alt={`${e.title} poster`} className="h-auto w-full" loading="lazy" />
              </a>
              <p className="mt-2 text-xs text-muted">Click to open the full-size poster.</p>
            </section>
          )}
          {e.rsvps.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 flex items-center gap-2 text-lg">
                <Users className="size-5 text-leaf" /> Who&apos;s going
              </h2>
              <div className="flex flex-wrap gap-2">
                {e.rsvps.map((r) => (
                  <Link key={r.userId} href={`/directory/${r.user.profile?.slug}`} title={r.user.profile?.orgName}>
                    <Avatar src={r.user.profile?.photoUrl} name={r.user.profile?.orgName ?? "?"} size={40} rounded="rounded-full" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
        <aside className="card h-fit space-y-4 p-6 lg:mt-10">
          <p className="flex gap-2">
            <CalendarDays className="size-5 shrink-0 text-leaf" />
            <span>
              <strong>{when.date}</strong>
              {when.time && (
                <>
                  <br />
                  {when.time}
                </>
              )}
            </span>
          </p>
          <p className="flex gap-2">
            {e.location ? <MapPin className="size-5 shrink-0 text-leaf" /> : <Video className="size-5 shrink-0 text-leaf" />} {e.location ?? "Online"}
          </p>
          {e.onlineUrl && going && (
            <a href={e.onlineUrl} target="_blank" rel="noopener noreferrer" className="block font-semibold text-leaf hover:underline">
              Join online ↗
            </a>
          )}
          {e.capacity && (
            <p className="text-sm text-muted">
              {e._count.rsvps} / {e.capacity} spots taken
            </p>
          )}
          <RsvpButton eventId={e.id} going={!!going} count={e._count.rsvps} signedIn={!!user} next={`/events/${e.id}`} full={!!e.capacity && e._count.rsvps >= e.capacity} past={past} />
          <p className="border-t border-line pt-4 text-sm text-muted">
            Hosted by{" "}
            {e.host ? (
              <Link href={`/directory/${e.host.slug}`} className="font-semibold text-leaf">
                {e.host.orgName}
              </Link>
            ) : (
              <strong>GRIS Canada</strong>
            )}
          </p>
        </aside>
      </div>
    </div>
  );
}
