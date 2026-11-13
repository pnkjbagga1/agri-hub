import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { db } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { visibleApproval } from "@/server/settings";
import { Avatar, ButtonLink, EmptyState, Pill } from "@/components/ui";
import { BUYER_TYPES, CATEGORIES, CATEGORY_LABEL, FREQUENCIES } from "@/lib/constants";
import { cn, formatDate, formatMoney, formatNumber, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Demand board — what BC buyers need", description: "Live buyer demand from BC retailers, restaurants, processors and exporters. Growers: offer to supply." };

export default async function DemandPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const user = await getSessionUser();
  const posts = await db.demandPost.findMany({
    where: { isOpen: true, ...(await visibleApproval()), buyer: { status: "active" }, ...(category && CATEGORIES.some((c) => c.key === category) ? { category: category as never } : {}) },
    include: { region: true, buyer: { select: { isVerified: true, profile: { select: { orgName: true, photoUrl: true, buyerType: true } } } } },
    orderBy: [{ neededBy: "asc" }],
  });
  return (
    <div className="container-page py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-leaf!">Markets & buyers</p>
          <h1 className="mt-2 text-3xl sm:text-[2.6rem]">Demand board</h1>
          <p className="mt-2 max-w-2xl text-muted">What retailers, food service, processors and exporters need — plan your plantings against real demand and offer to supply directly.</p>
        </div>
        {user?.role === "buyer" ? (
          <ButtonLink href="/dashboard/demand/new" variant="gold">
            <Megaphone className="size-4" /> Post a need
          </ButtonLink>
        ) : !user ? (
          <ButtonLink href="/signup?role=buyer" variant="gold">
            Buyers: post what you need
          </ButtonLink>
        ) : null}
      </div>
      <nav className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Categories">
        <Link href="/demand" className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset", !category ? "bg-primary text-white ring-primary" : "bg-white ring-line")}>
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c.key} href={`/demand?category=${c.key}`} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset", category === c.key ? "bg-primary text-white ring-primary" : "bg-white ring-line")}>
            {c.label}
          </Link>
        ))}
      </nav>
      {posts.length === 0 ? (
        <EmptyState icon={<Megaphone className="size-7" />} title="No open demand in this category" body="Check back soon, or browse all categories." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {posts.map((d) => (
            <Link key={d.id} href={`/demand/${d.id}`} className="card flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
              <div className="flex items-start gap-3">
                <Avatar src={d.buyer.profile?.photoUrl} name={d.buyer.profile?.orgName ?? "Buyer"} size={44} rounded="rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{d.title}</p>
                  <p className="text-sm text-muted">
                    {d.buyer.profile?.orgName} · {BUYER_TYPES.find((b) => b.key === d.buyer.profile?.buyerType)?.label ?? "Buyer"}
                  </p>
                </div>
                <Pill tone="gold">{FREQUENCIES.find((f) => f.key === d.frequency)?.label}</Pill>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted">Quantity</dt>
                  <dd className="font-semibold">
                    {formatNumber(d.quantity)} {d.unit}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Needed by</dt>
                  <dd className="font-semibold">{formatDate(d.neededBy)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Target</dt>
                  <dd className="font-semibold">{d.targetPrice != null ? formatMoney(d.targetPrice) : "Open"}</dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                <Pill>{CATEGORY_LABEL[d.category]}</Pill>
                {d.region && <span>{d.region.name}</span>}
                <span className="ml-auto">{timeAgo(d.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
