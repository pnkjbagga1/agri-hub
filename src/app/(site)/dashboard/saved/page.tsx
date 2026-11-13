import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Heart } from "lucide-react";
import { db } from "@/lib/db";
import { requireOnboarded } from "@/server/guards";
import { listingCardInclude } from "@/server/queries";
import { ListingCard } from "@/components/listings/ListingCard";
import { DeleteButton } from "@/components/DashboardBits";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Saved & alerts" };

type Q = { q?: string; category?: string[]; region?: string[]; cert?: string[] };

export default async function SavedPage() {
  const user = await requireOnboarded("/dashboard/saved");
  const [favorites, searches] = await Promise.all([
    db.favorite.findMany({ where: { userId: user.id }, include: { listing: { include: listingCardInclude } }, orderBy: { createdAt: "desc" } }),
    db.savedSearch.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const href = (q: Q) => {
    const p = new URLSearchParams();
    if (q.q) p.set("q", q.q);
    for (const k of ["category", "region", "cert"] as const) q[k]?.forEach((v) => p.append(k, v));
    return `/marketplace?${p}`;
  };
  return (
    <>
      <PageHeader eyebrow="Saved" title="Saved listings & search alerts" />
      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-xl">
          <BellRing className="size-5 text-leaf" /> Search alerts
        </h2>
        {searches.length === 0 ? (
          <p className="text-muted">
            Save a search from the{" "}
            <Link href="/marketplace" className="font-semibold text-leaf">
              marketplace
            </Link>{" "}
            and we&apos;ll notify you (in-app and email) when new matching listings are published.
          </p>
        ) : (
          <ul className="card divide-y divide-line">
            {searches.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                <Link href={href(s.query as Q)} className="font-semibold hover:text-leaf">
                  {s.name}
                </Link>
                <span className="text-xs text-muted">{s.lastNotifiedAt ? `last match ${formatDate(s.lastNotifiedAt)}` : "no matches yet"}</span>
                <span className="ml-auto">
                  <DeleteButton path={`/saved-searches/${s.id}`} label="Remove" confirmText="Remove this alert?" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xl">
          <Heart className="size-5 text-danger" /> Saved listings
        </h2>
        {favorites.length === 0 ? (
          <EmptyState title="Nothing saved yet" body="Tap the heart on any listing to keep it here." action={<ButtonLink href="/marketplace">Browse listings</ButtonLink>} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {favorites.map((f) => (
              <ListingCard key={f.listingId} listing={f.listing} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
