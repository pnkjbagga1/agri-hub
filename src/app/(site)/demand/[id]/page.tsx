import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { OfferToSupply } from "@/components/actions";
import { ReportButton } from "@/components/listings/ListingActions";
import { Avatar, Notice, Pill, VerifiedMark } from "@/components/ui";
import { BUYER_TYPES, CATEGORY_LABEL, FREQUENCIES } from "@/lib/constants";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Buyer demand" };

export default async function DemandDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const d = await db.demandPost.findUnique({ where: { id }, include: { region: true, buyer: { select: { id: true, isVerified: true, profile: { select: { orgName: true, photoUrl: true, slug: true, buyerType: true, tagline: true } } } } } });
  if (!d || (d.approval === "rejected" && user?.role !== "admin" && user?.id !== d.buyerId)) notFound();
  const own = user?.id === d.buyerId;
  return (
    <div className="container-page max-w-4xl py-10">
      <Link href="/demand" className="text-sm font-semibold text-leaf hover:underline">
        ← Demand board
      </Link>
      {!d.isOpen && <Notice className="mt-4">This request is closed.</Notice>}
      <div className="card mt-4 p-6 sm:p-8">
        <div className="flex flex-wrap gap-2">
          <Pill tone="gold">{FREQUENCIES.find((f) => f.key === d.frequency)?.label}</Pill>
          <Pill>{CATEGORY_LABEL[d.category]}</Pill>
          {d.region && <Pill tone="green">{d.region.name}</Pill>}
        </div>
        <h1 className="mt-3 text-3xl">{d.title}</h1>
        <dl className="mt-6 grid gap-4 sm:grid-cols-4">
          {[
            ["Produce", d.produce],
            ["Quantity", `${formatNumber(d.quantity)} ${d.unit}`],
            ["Needed by", formatDate(d.neededBy)],
            ["Target price", d.targetPrice != null ? formatMoney(d.targetPrice) : "Open to offers"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-cream p-3">
              <dt className="text-xs font-semibold text-muted uppercase">{k}</dt>
              <dd className="font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        {d.details && <p className="mt-6 leading-relaxed whitespace-pre-line text-ink-soft">{d.details}</p>}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <Link href={`/directory/${d.buyer.profile?.slug}`} className="flex items-center gap-3">
            <Avatar src={d.buyer.profile?.photoUrl} name={d.buyer.profile?.orgName ?? "Buyer"} size={48} rounded="rounded-xl" />
            <div>
              <p className="flex items-center gap-1.5 font-bold">
                {d.buyer.profile?.orgName} {d.buyer.isVerified && <VerifiedMark label={false} />}
              </p>
              <p className="text-sm text-muted">{BUYER_TYPES.find((b) => b.key === d.buyer.profile?.buyerType)?.label}</p>
            </div>
          </Link>
          {own ? (
            <Link href="/dashboard/demand" className="rounded-full bg-primary px-5 py-3 font-semibold text-white">
              Manage my posts
            </Link>
          ) : d.isOpen ? (
            <OfferToSupply demandId={d.id} signedIn={!!user} canOffer={!!user && ["grower", "supplier", "dealer"].includes(user.role)} next={`/demand/${d.id}`} />
          ) : null}
        </div>
      </div>
      <div className="mt-3 text-right">
        <ReportButton targetType="demand" targetId={d.id} signedIn={!!user && !own} />
      </div>
    </div>
  );
}
