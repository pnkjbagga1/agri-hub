import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, ShoppingBasket, Sprout, Handshake, QrCode, CalendarDays, Megaphone } from "lucide-react";
import { db } from "@/lib/db";
import { listingCardInclude, platformMetrics } from "@/server/queries";
import { visibleApproval } from "@/server/settings";
import { ListingCard } from "@/components/listings/ListingCard";
import { ButtonLink, Pill, SectionHeader } from "@/components/ui";
import { RESOURCE_LABEL, CATEGORY_LABEL, EIGHT_DOORS } from "@/lib/constants";
import { asset } from "@/lib/paths";
import { formatDate, formatNumber } from "@/lib/utils";


export default async function HomePage() {
  const vis = await visibleApproval();
  const [featured, programs, metrics, demand, events, buyBcProducts, buyBcOrgs] = await Promise.all([
    db.listing.findMany({ where: { status: "active", ...vis, grower: { status: "active" } }, include: listingCardInclude, orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }], take: 4 }),
    db.resource.findMany({ where: { approval: "approved" }, include: { profile: { select: { orgName: true, slug: true, photoUrl: true } } }, orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }], take: 4 }),
    platformMetrics(),
    db.demandPost.findMany({ where: { isOpen: true, ...vis }, include: { buyer: { select: { profile: { select: { orgName: true, buyerType: true } } } } }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.event.findMany({ where: { approval: "approved", startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 3 }),
    db.buyBcProduct.count(),
    db.profile.count({ where: { buyBcProducts: { some: {} } } }),
  ]);

  return (
    <>
      {/* HERO — mirrors griscanada.org/hub */}
      <section className="bg-primary text-white">
        <div className="container-page grid items-center gap-12 py-14 lg:grid-cols-[1.2fr_.8fr] lg:py-20">
          <div>
            <p className="eyebrow">The Agri Hub · Marketplace</p>
            <h1 className="mt-4 text-[2.4rem] leading-[1.04] text-white sm:text-[3.4rem]">
              Everything a growing farm needs, <span className="accent text-gold-soft">in one place.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/80">
              List your harvest, find local supply, request quotes, and reach funding, experts, suppliers, processors and buyers — the working marketplace behind GRIS Canada&apos;s programs.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup?role=grower" size="lg" variant="gold">
                <Sprout className="size-5" /> I&apos;m a Grower
              </ButtonLink>
              <ButtonLink href="/signup?role=buyer" size="lg" variant="light">
                <ShoppingBasket className="size-5" /> I&apos;m a Buyer / Partner
              </ButtonLink>
            </div>
            <p className="mt-5 text-sm text-white/65">
              Free to join · No commission on your sales ·{" "}
              <Link href="/marketplace" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
                Browse {metrics.activeListings} live listings →
              </Link>
            </p>
          </div>
          <div className="rounded-[18px] bg-primary-dark p-6 ring-1 ring-white/10">
            <div className="flex items-center gap-4">
              <Image src={asset("/brand/GRIS_Logo_Badge.png")} alt="GRIS Canada badge" width={84} height={86} />
              <div>
                <p className="eyebrow">Why it matters</p>
                <p className="font-display text-5xl font-black text-white">77.1%</p>
                <p className="text-sm text-white/70">of BC&apos;s fresh vegetables are imported</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                [formatNumber(metrics.growers), "growers"],
                [formatNumber(metrics.buyers), "buyers"],
                [formatNumber(metrics.partners), "partners"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                  <p className="font-display text-2xl font-black text-gold-soft">{v}</p>
                  <p className="text-xs text-white/65">{l} on the Hub</p>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-xl bg-highlight/15 p-4 text-sm text-white/90 ring-1 ring-highlight/30">
              <strong className="text-gold-soft">5-year goal:</strong> move BC vegetable import dependence from 77.1% toward 55–60%.
            </p>
            <Link href="/buy-bc" className="mt-3 block rounded-xl bg-white/5 p-4 text-sm text-white/90 ring-1 ring-white/10 hover:bg-white/10">
              <strong className="text-gold-soft">{formatNumber(buyBcProducts)} Buy BC products</strong> from {formatNumber(buyBcOrgs)} BC businesses — search the catalogue →
            </Link>
          </div>
        </div>
      </section>

      {/* EIGHT DOORS — same structure as griscanada.org/hub */}
      <section className="container-page py-14">
        <p className="eyebrow text-leaf!">Inside the Hub</p>
        <h2 className="mt-2 text-3xl sm:text-[2.8rem]">Eight doors, one hallway.</h2>
        <p className="mt-3 max-w-2xl text-muted">Members use the Hub to find what a season demands, when it demands it. Every door below opens live listings, profiles and programs.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EIGHT_DOORS.map((d) => (
            <Link key={d.n} href={d.href} className="card group flex flex-col p-[26px] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
              <span className="font-display text-sm font-black text-highlight">{d.n}</span>
              <h3 className="mt-2 text-xl">{d.title}</h3>
              <p className="mt-2 text-[15px] text-muted">{d.body}</p>
              <span className="mt-auto pt-4 text-sm font-semibold text-leaf group-hover:underline">Open →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED LISTINGS */}
      <section className="container-page py-10">
        <SectionHeader
          eyebrow="Fresh from BC farms"
          title="Featured produce listings"
          subtitle="Harvest-window aware: buy what's in season now or pre-book next season's volume."
          action={
            <ButtonLink href="/marketplace" variant="outline">
              All listings <ArrowRight className="size-4" />
            </ButtonLink>
          }
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container-page py-12">
        <div className="grid gap-4 rounded-[18px] bg-primary p-8 text-white sm:p-12 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-2 text-3xl text-white">Three steps to <span className="accent text-gold-soft">connected.</span></h2>
          </div>
          {[
            { icon: Sprout, t: "List or post a need", b: "Growers list produce with photos and harvest windows. Buyers post what they need on the demand board." },
            { icon: Handshake, t: "Request quotes, chat directly", b: "Structured RFQs with quantity, delivery date and target price, plus in-app messaging." },
            { icon: QrCode, t: "Trust built in", b: "Certification badges, verified profiles, reviews and lot-level traceability QR codes." },
          ].map((s) => (
            <div key={s.t} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <s.icon className="size-7 text-highlight" />
              <p className="mt-3 font-semibold">{s.t}</p>
              <p className="mt-1 text-sm text-white/70">{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DEMAND + EVENTS */}
      <section className="container-page grid gap-8 py-10 lg:grid-cols-2">
        <div className="min-w-0">
          <SectionHeader eyebrow="Demand board" title="What buyers need now" action={<ButtonLink href="/demand" variant="ghost" size="sm">See all <ArrowRight className="size-4" /></ButtonLink>} />
          <div className="space-y-3">
            {demand.map((d) => (
              <Link key={d.id} href={`/demand/${d.id}`} className="card flex items-center justify-between gap-4 p-4 transition hover:shadow-[var(--shadow-lift)]">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{d.title}</p>
                  <p className="text-sm text-muted">
                    {formatNumber(d.quantity)} {d.unit} · {CATEGORY_LABEL[d.category]} · needed by {formatDate(d.neededBy)}
                  </p>
                </div>
                <Pill tone="gold">{d.frequency.replace("_", "-")}</Pill>
              </Link>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <SectionHeader eyebrow="Events" title="Upcoming in the community" action={<ButtonLink href="/events" variant="ghost" size="sm">Calendar <ArrowRight className="size-4" /></ButtonLink>} />
          <div className="space-y-3">
            {events.map((e) => (
              <Link key={e.id} href={`/events/${e.id}`} className="card flex items-center gap-4 p-4 transition hover:shadow-[var(--shadow-lift)]">
                <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-primary-soft text-center text-primary">
                  <span className="text-[11px] font-bold uppercase">{formatDate(e.startsAt, { month: "short" })}</span>
                  <span className="-mt-2 font-display text-xl font-bold">{formatDate(e.startsAt, { day: "numeric" })}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{e.title}</p>
                  <p className="flex items-center gap-1 text-sm text-muted">
                    <CalendarDays className="size-3.5" /> {e.location ?? "Online"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PARTNER PROGRAMS */}
      <section className="container-page py-10">
        <div className="rounded-[2rem] bg-sand/70 p-6 sm:p-10">
          <SectionHeader eyebrow="Partner programs & resources" title="Funding, financing & expertise" subtitle="EDC, FCC, BC and federal programs, universities and ag-tech partners — with one-click expressions of interest." action={<ButtonLink href="/resources" variant="outline">Programs hub <ArrowRight className="size-4" /></ButtonLink>} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {programs.map((r) => (
              <Link key={r.id} href={`/resources/${r.id}`} className="card flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
                <Pill tone="green" className="self-start">{RESOURCE_LABEL[r.type]}</Pill>
                <p className="mt-3 font-semibold">{r.title}</p>
                <p className="mt-1 line-clamp-3 text-sm text-muted">{r.summary}</p>
                <p className="mt-auto pt-4 text-xs font-semibold text-secondary">{r.profile.orgName}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="container-page py-10">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: ShieldCheck, t: "Verified & certified", b: "Organic, Buy BC and CanadaGAP badges with document review by GRIS Canada." },
            { icon: Megaphone, t: "Non-profit, no commission", b: "A sector-development tool — growers and buyers keep 100% of their deal." },
            { icon: Handshake, t: "Built for scale", b: "Region-based design ready for every Canadian province and international partners." },
          ].map((s) => (
            <div key={s.t} className="flex gap-4 rounded-2xl p-4">
              <s.icon className="size-8 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">{s.t}</p>
                <p className="text-sm text-muted">{s.b}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
