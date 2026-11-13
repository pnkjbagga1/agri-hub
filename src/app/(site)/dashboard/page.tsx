import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle, Eye, FileText, Heart, Megaphone, MessageSquare, Package, Sprout, Users, CalendarDays } from "lucide-react";
import { db } from "@/lib/db";
import { requireOnboarded } from "@/server/guards";
import { listingCardInclude, weeklySeries } from "@/server/queries";
import { LineChart } from "@/components/charts";
import { ListingCard } from "@/components/listings/ListingCard";
import { ListingsTable } from "@/components/listings/ListingsTable";
import { ButtonLink, EmptyState, Pill, StatCard } from "@/components/ui";
import { PARTNER_ROLES, RESOURCE_LABEL, type RoleKey } from "@/lib/constants";
import { formatDate, formatMoney, formatNumber, timeAgo } from "@/lib/utils";
import type { SessionUser } from "@/server/session";

export const metadata: Metadata = { title: "Dashboard" };

type Action = { done: boolean; label: string; href: string };

function Checklist({ items }: { items: Action[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((a) => (
        <li key={a.label}>
          <Link href={a.href} className="flex items-start gap-2.5 rounded-lg p-1 text-[15px] hover:bg-sand/60">
            {a.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-leaf" /> : <Circle className="mt-0.5 size-5 shrink-0 text-line" />}
            <span className={a.done ? "text-muted line-through" : "font-medium"}>{a.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

async function GrowerDashboard({ user }: { user: SessionUser }) {
  const [listings, inquiriesMonth, accepted, listingViews, openRfqs, certDocs, upcoming, views, inquiries] = await Promise.all([
    db.listing.findMany({ where: { growerId: user.id, status: { not: "archived" } }, orderBy: { createdAt: "desc" }, include: { _count: { select: { threads: true, rfqs: true } } } }),
    db.thread.count({ where: { createdAt: { gte: monthStart() }, participants: { some: { userId: user.id } }, listing: { growerId: user.id } } }),
    db.rfq.findMany({ where: { growerId: user.id, status: "accepted" }, select: { quantity: true, unit: true, quotePrice: true } }),
    db.listing.aggregate({ where: { growerId: user.id }, _sum: { views: true } }),
    db.rfq.count({ where: { growerId: user.id, status: "open" } }),
    db.certificationDoc.count({ where: { profileId: user.profile!.id } }),
    db.event.findFirst({ where: { approval: "approved", startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } }),
    weeklySeries(["listing_view"], 12, user.id),
    weeklySeries(["inquiry", "rfq"], 12, user.id),
  ]);
  const active = listings.filter((l) => l.status === "active").length;
  const toKg = (q: number, u: string) => (u === "kg" ? q : u === "tonne" ? q * 1000 : u === "lb" ? q * 0.4536 : 0);
  const kgSold = accepted.reduce((s, r) => s + toKg(r.quantity, r.unit), 0);
  const revenue = accepted.reduce((s, r) => s + (r.quotePrice ?? 0) * r.quantity, 0);
  const actions: Action[] = [
    { done: listings.length > 0, label: "Publish your first listing with photos", href: "/dashboard/listings/new" },
    { done: certDocs > 0, label: "Upload a certification document (Organic, Buy BC, CanadaGAP)", href: "/dashboard/profile#certificates" },
    { done: openRfqs === 0, label: openRfqs ? `Respond to ${openRfqs} pending RFQ${openRfqs > 1 ? "s" : ""}` : "No pending RFQs — you're up to date", href: "/dashboard/rfqs" },
    { done: listings.every((l) => l.harvestStart), label: "Add harvest windows so buyers can pre-book", href: "/dashboard/listings" },
    { done: !!user.profile?.coverUrl, label: "Add a cover photo of your farm", href: "/dashboard/profile" },
    ...(upcoming ? [{ done: false, label: `Join: ${upcoming.title} (${formatDate(upcoming.startsAt, { month: "short", day: "numeric" })})`, href: `/events/${upcoming.id}` }] : []),
  ];
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-leaf!">Grower dashboard</p>
          <h1 className="mt-1 text-3xl">Welcome back, {user.profile!.orgName}</h1>
        </div>
        <ButtonLink href="/dashboard/listings/new" variant="gold">
          <Sprout className="size-4" /> Add listing
        </ButtonLink>
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Active listings" value={active} icon={<Package className="size-4" />} hint={`${listings.length} total`} />
        <StatCard label="Inquiries this month" value={inquiriesMonth} icon={<MessageSquare className="size-4" />} tone="gold" hint={`${openRfqs} RFQs awaiting reply`} />
        <StatCard label="Est. volume sold" value={`${formatNumber(Math.round(kgSold))} kg`} icon={<FileText className="size-4" />} tone="blue" hint={revenue ? `≈ ${formatMoney(revenue)} in accepted quotes` : "From accepted quotes"} />
        <StatCard label="Profile & listing views" value={formatNumber((user.profile!.views ?? 0) + (listingViews._sum.views ?? 0))} icon={<Eye className="size-4" />} tone="ink" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="card p-6">
          <h2 className="text-lg">Demand signal — buyer interest over time</h2>
          <p className="mb-4 text-sm text-muted">Weekly listing views and inquiries/RFQs over the last 12 weeks.</p>
          <LineChart
            ariaLabel="Weekly listing views and inquiries"
            series={[
              { name: "Listing views", color: "#1e7a3c", points: views },
              { name: "Inquiries & RFQs", color: "#bc8a2e", points: inquiries },
            ]}
          />
        </section>
        <section className="card p-6">
          <h2 className="mb-4 text-lg">Recommended actions</h2>
          <Checklist items={actions} />
        </section>
      </div>
      <section className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-3">
          <h2 className="text-lg">My listings</h2>
          <Link href="/dashboard/listings" className="text-sm font-semibold text-leaf hover:underline">
            Manage all →
          </Link>
        </div>
        <ListingsTable rows={listings.slice(0, 6).map((l) => ({ id: l.id, slug: l.slug, title: l.title, photo: l.photos[0] ?? null, volume: `${formatNumber(l.volume)} ${l.unit}`, status: l.status, approval: l.approval, inquiries: l._count.threads, rfqs: l._count.rfqs }))} />
      </section>
    </>
  );
}

async function BuyerDashboard({ user }: { user: SessionUser }) {
  const [rfqs, favorites, demand, threads, openQuotes] = await Promise.all([
    db.rfq.findMany({ where: { buyerId: user.id }, orderBy: { createdAt: "desc" }, take: 5, include: { listing: { select: { title: true, slug: true } }, grower: { select: { profile: { select: { orgName: true } } } } } }),
    db.favorite.findMany({ where: { userId: user.id }, include: { listing: { include: listingCardInclude } }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.demandPost.findMany({ where: { buyerId: user.id, isOpen: true }, orderBy: { createdAt: "desc" } }),
    db.thread.count({ where: { participants: { some: { userId: user.id } } } }),
    db.rfq.count({ where: { buyerId: user.id, status: "quoted" } }),
  ]);
  // Supply matches: active listings for the produce in my open demand posts
  const matches = demand.length
    ? await db.listing.findMany({ where: { status: "active", approval: { not: "rejected" }, OR: demand.flatMap((d) => [{ produce: { contains: d.produce, mode: "insensitive" as const } }, { category: d.category }]) }, include: listingCardInclude, take: 3, orderBy: { createdAt: "desc" } })
    : [];
  const tone = { open: "neutral", quoted: "gold", accepted: "green", declined: "red", withdrawn: "neutral" } as const;
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-leaf!">Buyer dashboard</p>
          <h1 className="mt-1 text-3xl">Welcome back, {user.profile!.orgName}</h1>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/dashboard/demand/new" variant="gold">
            <Megaphone className="size-4" /> Post a need
          </ButtonLink>
          <ButtonLink href="/marketplace" variant="outline">
            Browse supply
          </ButtonLink>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Quotes to review" value={openQuotes} icon={<FileText className="size-4" />} tone="gold" />
        <StatCard label="Conversations" value={threads} icon={<MessageSquare className="size-4" />} />
        <StatCard label="Open demand posts" value={demand.length} icon={<Megaphone className="size-4" />} tone="blue" />
        <StatCard label="Saved listings" value={favorites.length} icon={<Heart className="size-4" />} tone="ink" />
      </div>
      <section className="card mt-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg">Recent RFQs</h2>
          <Link href="/dashboard/rfqs" className="text-sm font-semibold text-leaf hover:underline">
            All RFQs →
          </Link>
        </div>
        {rfqs.length === 0 ? (
          <p className="text-sm text-muted">No RFQs yet — open any listing and choose “Send Inquiry / RFQ”.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rfqs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href={`/messages/${r.threadId}`} className="font-semibold hover:text-leaf">
                    {r.listing?.title ?? "RFQ"}
                  </Link>
                  <p className="text-sm text-muted">
                    {r.grower.profile?.orgName} · {formatNumber(r.quantity)} {r.unit} · {timeAgo(r.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {r.quotePrice != null && <span className="font-semibold">{formatMoney(r.quotePrice)}/{r.unit}</span>}
                  <Pill tone={tone[r.status]}>{r.status}</Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {matches.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-xl">Supply matching your demand posts</h2>
          <p className="mb-4 text-sm text-muted">Based on: {demand.map((d) => d.produce).join(", ")}</p>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {matches.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
      {favorites.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-xl">Recently saved</h2>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {favorites.map((f) => (
              <ListingCard key={f.listingId} listing={f.listing} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

async function PartnerDashboard({ user }: { user: SessionUser }) {
  const pid = user.profile!.id;
  const [resources, leads, events, views] = await Promise.all([
    db.resource.findMany({ where: { profileId: pid }, include: { _count: { select: { interests: true } } }, orderBy: { createdAt: "desc" } }),
    db.resourceInterest.findMany({ where: { resource: { profileId: pid } }, include: { resource: { select: { title: true } }, user: { select: { profile: { select: { orgName: true, slug: true } } } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.event.findMany({ where: { hostProfileId: pid }, include: { _count: { select: { rsvps: true } } }, orderBy: { startsAt: "asc" } }),
    weeklySeries(["profile_view", "resource_interest"], 12, user.id),
  ]);
  const newLeads = leads.filter((l) => l.status === "new").length;
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-leaf!">Partner dashboard</p>
          <h1 className="mt-1 text-3xl">Welcome back, {user.profile!.orgName}</h1>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/dashboard/resources/new" variant="gold">
            Post a program or offer
          </ButtonLink>
          <ButtonLink href="/dashboard/events/new" variant="outline">
            Host an event
          </ButtonLink>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Programs & offers" value={resources.length} icon={<FileText className="size-4" />} />
        <StatCard label="New leads" value={newLeads} icon={<Users className="size-4" />} tone="gold" hint={`${leads.length} recent`} />
        <StatCard label="Events hosted" value={events.length} icon={<CalendarDays className="size-4" />} tone="blue" hint={`${events.reduce((s, e) => s + e._count.rsvps, 0)} RSVPs`} />
        <StatCard label="Profile views" value={formatNumber(user.profile!.views)} icon={<Eye className="size-4" />} tone="ink" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card p-6">
          <h2 className="text-lg">Engagement</h2>
          <p className="mb-4 text-sm text-muted">Weekly profile views and expressions of interest.</p>
          <LineChart ariaLabel="Weekly partner engagement" series={[{ name: "Engagement", color: "#1e7a3c", points: views }]} />
        </section>
        <section className="card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg">Latest leads</h2>
            <Link href="/dashboard/leads" className="text-sm font-semibold text-leaf hover:underline">
              All →
            </Link>
          </div>
          {leads.length === 0 ? (
            <p className="text-sm text-muted">When growers express interest in your programs, they appear here.</p>
          ) : (
            <ul className="space-y-3">
              {leads.map((l) => (
                <li key={l.id} className="text-sm">
                  <Link href={`/directory/${l.user.profile?.slug}`} className="font-semibold hover:text-leaf">
                    {l.user.profile?.orgName}
                  </Link>{" "}
                  <span className="text-muted">→ {l.resource.title}</span>
                  <span className="block text-xs text-muted">{timeAgo(l.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="card mt-6 p-6">
        <h2 className="mb-4 text-lg">Your programs & offers</h2>
        {resources.length === 0 ? (
          <EmptyState title="Share your first program" body="Grants, loans, courses, demos or services — growers can express interest in one click." action={<ButtonLink href="/dashboard/resources/new">Post a program</ButtonLink>} />
        ) : (
          <ul className="divide-y divide-line">
            {resources.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/resources/${r.id}`} className="font-semibold hover:text-leaf">
                    {r.title}
                  </Link>
                  <p className="text-sm text-muted">{RESOURCE_LABEL[r.type]}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone="gold">{r._count.interests} interested</Pill>
                  <Pill tone={r.approval === "approved" ? "green" : r.approval === "rejected" ? "red" : "neutral"}>{r.approval}</Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default async function DashboardPage() {
  const user = await requireOnboarded();
  if (user.role === "grower") return <GrowerDashboard user={user} />;
  if (PARTNER_ROLES.includes(user.role as RoleKey)) return <PartnerDashboard user={user} />;
  return <BuyerDashboard user={user} />;
}
