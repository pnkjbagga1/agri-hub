import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Leaf, MapPin, Sprout, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { Avatar, CertBadge, VerifiedMark } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Lot traceability" };

/** Public farm-to-buyer trace page reached from the QR code on each lot. */
export default async function TracePage({ params }: { params: Promise<{ lot: string }> }) {
  const { lot } = await params;
  const l = await db.listing.findUnique({
    where: { lotCode: decodeURIComponent(lot).toUpperCase() },
    include: { region: true, grower: { select: { isVerified: true, profile: { select: { orgName: true, slug: true, photoUrl: true, city: true } } } }, rfqs: { where: { status: "accepted" }, select: { closedAt: true } } },
  });
  if (!l || l.approval === "rejected" || l.status === "draft") notFound();
  const p = l.grower.profile!;
  const steps = [
    { icon: Sprout, title: "Grown", body: `${p.orgName}, ${p.city ?? l.region?.name ?? ""}, BC`, date: null as Date | null },
    { icon: Leaf, title: "Harvest window", body: l.harvestStart ? `${formatDate(l.harvestStart)} – ${formatDate(l.harvestEnd)}` : "Year-round / from storage", date: null },
    { icon: CheckCircle2, title: "Listed on AGRI HUB", body: `Lot ${l.lotCode} · ${l.produce}${l.variety ? ` (${l.variety})` : ""}`, date: l.createdAt },
    ...(l.rfqs.length ? [{ icon: Truck, title: "Sold to buyers on AGRI HUB", body: `${l.rfqs.length} accepted order(s)`, date: l.rfqs[0]!.closedAt }] : []),
  ];
  return (
    <div className="container-page max-w-2xl py-10">
      <p className="eyebrow text-leaf!">Lot traceability</p>
      <h1 className="mt-2 text-3xl">
        {l.produce} — lot <span className="font-mono">{l.lotCode}</span>
      </h1>
      <div className="card mt-6 flex items-center gap-4 p-5">
        <Avatar src={p.photoUrl} name={p.orgName} size={56} />
        <div>
          <Link href={`/directory/${p.slug}`} className="flex items-center gap-1.5 font-bold hover:text-leaf">
            {p.orgName} {l.grower.isVerified && <VerifiedMark />}
          </Link>
          <p className="flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5" /> {[p.city, l.region?.name, "BC, Canada"].filter(Boolean).join(", ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {l.certifications.map((c) => (
              <CertBadge key={c} cert={c} />
            ))}
          </div>
        </div>
      </div>
      <ol className="relative mt-8 ml-4 space-y-6 border-l-2 border-line pl-8">
        {steps.map((s) => (
          <li key={s.title} className="relative">
            <span className="absolute top-0 -left-[49px] grid size-8 place-items-center rounded-full bg-primary text-white">
              <s.icon className="size-4" />
            </span>
            <p className="font-bold">{s.title}</p>
            <p className="text-ink-soft">{s.body}</p>
            {s.date && <p className="text-xs text-muted">{formatDate(s.date)}</p>}
          </li>
        ))}
      </ol>
      <p className="mt-10 text-sm text-muted">
        Trace data is provided by the grower through AGRI HUB, GRIS Canada&apos;s agri-food connection platform.{" "}
        <Link href={`/marketplace/${l.slug}`} className="font-semibold text-leaf">
          View listing →
        </Link>
      </p>
    </div>
  );
}
