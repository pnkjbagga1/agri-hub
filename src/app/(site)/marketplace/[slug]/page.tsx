import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CalendarRange, MapPin, Package, Scale, Truck, Tag, QrCode as QrIcon } from "lucide-react";
import { db } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { listingCardInclude, ratingFor } from "@/server/queries";
import { getSettings } from "@/server/settings";
import { track } from "@/server/notify";
import { Gallery } from "@/components/listings/Gallery";
import { ListingActions, ReportButton } from "@/components/listings/ListingActions";
import { ListingCard } from "@/components/listings/ListingCard";
import { Avatar, CertBadge, Notice, Pill, RoleBadge, Stars, VerifiedMark } from "@/components/ui";
import { CATEGORY_LABEL, DELIVERY_OPTIONS, PRICING_METHODS } from "@/lib/constants";
import { formatDate, formatMoney, formatNumber, harvestState } from "@/lib/utils";

type P = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  return db.listing.findUnique({
    where: { slug },
    include: { region: true, grower: { include: { profile: { include: { region: true } } } } },
  });
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const l = await load((await params).slug);
  if (!l) return {};
  return { title: `${l.title} — ${l.grower.profile?.orgName}`, description: l.description?.slice(0, 160) ?? undefined, openGraph: { images: l.photos[0]?.endsWith(".svg") ? [] : l.photos.slice(0, 1) } };
}

export default async function ListingPage({ params }: P) {
  const { slug } = await params;
  const l = await load(slug);
  const user = await getSessionUser();
  const settings = await getSettings();
  const isOwner = !!user && user.id === l?.growerId;
  const isAdmin = user?.role === "admin";
  if (!l) notFound();
  const hidden = l.approval === "rejected" || (settings.moderation === "pre" && l.approval !== "approved") || l.status === "archived" || l.status === "draft" || l.grower.status !== "active";
  if (hidden && !isOwner && !isAdmin) notFound();

  if (!isOwner) {
    await db.listing.update({ where: { id: l.id }, data: { views: { increment: 1 } } });
    await track("listing_view", { userId: user?.id, listingId: l.id, ownerId: l.growerId });
  }

  const [rating, saved, thread, similar, qr] = await Promise.all([
    ratingFor(l.growerId),
    user ? db.favorite.findUnique({ where: { userId_listingId: { userId: user.id, listingId: l.id } } }) : null,
    user ? db.thread.findFirst({ where: { listingId: l.id, participants: { some: { userId: user.id } }, AND: { participants: { some: { userId: l.growerId } } } }, select: { id: true } }) : null,
    db.listing.findMany({ where: { id: { not: l.id }, status: "active", approval: { not: "rejected" }, OR: [{ category: l.category }, { produce: l.produce }] }, include: listingCardInclude, take: 3, orderBy: { createdAt: "desc" } }),
    QRCode.toString(`${process.env.APP_URL ?? ""}/trace/${l.lotCode}`, { type: "svg", margin: 0, color: { dark: "#152219", light: "#ffffff00" } }),
  ]);
  const p = l.grower.profile!;
  const h = harvestState(l.harvestStart, l.harvestEnd);
  const facts = [
    { icon: Scale, label: "Available volume", value: `${formatNumber(l.volume)} ${l.unit}` },
    { icon: CalendarRange, label: "Harvest window", value: l.harvestStart || l.harvestEnd ? `${formatDate(l.harvestStart)} – ${formatDate(l.harvestEnd)}` : "Available now" },
    { icon: Tag, label: "Price", value: l.price != null ? `${formatMoney(l.price)} / ${l.priceUnit ?? l.unit}${l.pricingMethod === "negotiable" ? " (negotiable)" : ""}` : (PRICING_METHODS.find((m) => m.key === l.pricingMethod)?.label ?? "On request") },
    { icon: Package, label: "Minimum order", value: l.minOrder ? `${formatNumber(l.minOrder)} ${l.unit}` : "No minimum" },
    { icon: Truck, label: "Delivery", value: l.deliveryOptions.map((d) => DELIVERY_OPTIONS.find((o) => o.key === d)?.label ?? d).join(" · ") || "Contact grower" },
    { icon: MapPin, label: "Pickup / area", value: [l.pickupLocation, l.deliveryArea].filter(Boolean).join(" · ") || l.region?.name || "—" },
  ];

  return (
    <div className="container-page py-8">
      <nav className="mb-5 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/marketplace" className="hover:text-primary">Marketplace</Link> <span aria-hidden>/</span> <Link href={`/marketplace?category=${l.category}`} className="hover:text-primary">{CATEGORY_LABEL[l.category]}</Link> <span aria-hidden>/</span> <span className="text-ink">{l.produce}</span>
      </nav>
      {(isOwner || isAdmin) && l.approval !== "approved" && (
        <Notice tone={l.approval === "rejected" ? "error" : "warn"} className="mb-5">
          {l.approval === "rejected" ? `This listing was not approved${l.rejectionReason ? `: ${l.rejectionReason}` : ""}. Edit it to resubmit.` : settings.moderation === "pre" ? "Pending review — only you and moderators can see it until it's approved." : "Live and pending a routine moderator review."}
        </Notice>
      )}
      <div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr]">
        <Gallery photos={l.photos} alt={l.title} />
        <div>
          <div className="flex flex-wrap gap-2">
            <Pill tone={h.key === "upcoming" ? "gold" : h.key === "ended" ? "neutral" : "green"}>{h.label}</Pill>
            <Pill>{CATEGORY_LABEL[l.category]}</Pill>
            {l.status !== "active" && <Pill tone="red">{l.status.replace("_", " ")}</Pill>}
          </div>
          <h1 className="mt-3 text-3xl leading-tight sm:text-[2.4rem]">{l.title}</h1>
          <p className="mt-2 text-muted">
            <Link href={`/directory/${p.slug}`} className="font-semibold text-primary hover:underline">{p.orgName}</Link> · {p.city ?? l.region?.name}, BC {l.variety && <>· Variety: {l.variety}</>}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {l.certifications.map((c) => (
              <CertBadge key={c} cert={c} />
            ))}
          </div>
          {l.description && <p className="mt-5 leading-relaxed whitespace-pre-line text-ink-soft">{l.description}</p>}
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label} className="flex gap-3 rounded-xl bg-white p-3 ring-1 ring-line">
                <f.icon className="mt-0.5 size-5 shrink-0 text-leaf" />
                <div>
                  <dt className="text-xs font-semibold text-muted uppercase">{f.label}</dt>
                  <dd className="text-[15px] font-semibold">{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>
          <div className="mt-7">
            <ListingActions listingId={l.id} growerId={l.growerId} growerName={p.orgName} unit={l.unit} signedIn={!!user} isOwner={isOwner} saved={!!saved} threadId={thread?.id} path={`/marketplace/${l.slug}`} />
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <section className="card p-6">
          <h2 className="text-xl">About the grower</h2>
          <div className="mt-4 flex items-start gap-4">
            <Avatar src={p.photoUrl} name={p.orgName} size={64} />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-bold">
                {p.orgName} {l.grower.isVerified && <VerifiedMark />}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <RoleBadge role="grower" />
                <Stars value={rating.avg} count={rating.count} />
              </div>
              {p.tagline && <p className="mt-2 text-sm text-muted">{p.tagline}</p>}
              <Link href={`/directory/${p.slug}`} className="mt-3 inline-block text-sm font-semibold text-leaf hover:underline">View full profile & all listings →</Link>
            </div>
          </div>
        </section>
        <section className="card flex items-center gap-5 p-6">
          <div className="size-28 shrink-0 rounded-xl bg-white p-2 ring-1 ring-line" dangerouslySetInnerHTML={{ __html: qr }} aria-label="Traceability QR code" role="img" />
          <div>
            <h2 className="flex items-center gap-2 text-xl"><QrIcon className="size-5 text-leaf" /> Lot traceability</h2>
            <p className="mt-1 text-sm text-muted">Lot <strong className="font-mono text-ink">{l.lotCode}</strong>. Scan or share the farm-to-buyer trace page for this lot.</p>
            <Link href={`/trace/${l.lotCode}`} className="mt-2 inline-block text-sm font-semibold text-leaf hover:underline">Open trace page →</Link>
          </div>
        </section>
      </div>
      <div className="mt-4 flex justify-end">
        <ReportButton targetType="listing" targetId={l.id} signedIn={!!user && !isOwner} label="Report this listing" />
      </div>

      {similar.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 text-2xl">Similar listings</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((s) => (
              <ListingCard key={s.id} listing={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
