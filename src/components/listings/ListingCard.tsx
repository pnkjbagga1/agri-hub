import Link from "next/link";
import { MapPin, CalendarClock } from "lucide-react";
import type { ListingCardData } from "@/server/queries";
import { Avatar, CertBadge, VerifiedMark } from "@/components/ui";
import { cn, formatMoney, harvestState } from "@/lib/utils";
import { asset } from "@/lib/paths";

export function ListingCard({ listing, distanceKm }: { listing: ListingCardData; distanceKm?: number | null }) {
  const h = harvestState(listing.harvestStart, listing.harvestEnd);
  const p = listing.grower.profile;
  return (
    <article className="card group relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-sand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(listing.photos[0] ?? "/seed/greens-1.svg")} alt={`${listing.produce} from ${p?.orgName}`} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        <span
          className={cn(
            "absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm",
            h.key === "upcoming" ? "bg-highlight text-ink" : h.key === "ended" ? "bg-white/90 text-muted" : "bg-primary text-white",
          )}
        >
          {h.label}
        </span>
        {listing.isFeatured && <span className="absolute top-3 right-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#7a5a12]">★ Featured</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-sans text-[15px] leading-snug font-bold">
            <Link href={`/marketplace/${listing.slug}`} className="after:absolute after:inset-0">
              {listing.title}
            </Link>
          </h3>
        </div>
        <p className="mt-1 text-lg font-bold text-primary">
          {listing.price != null ? (
            <>
              {formatMoney(listing.price)}
              <span className="text-sm font-medium text-muted"> / {listing.priceUnit ?? listing.unit}</span>
            </>
          ) : (
            <span className="text-base">{listing.pricingMethod === "rfq" ? "Request a quote" : "Price on request"}</span>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {listing.certifications.slice(0, 3).map((c) => (
            <CertBadge key={c} cert={c} />
          ))}
        </div>
        <div className="mt-auto flex items-center gap-2.5 border-t border-line/70 pt-3 text-sm">
          <Avatar src={p?.photoUrl} name={p?.orgName ?? "Grower"} size={30} rounded="rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate font-semibold">
              <span className="truncate">{p?.orgName}</span>
              {listing.grower.isVerified && <VerifiedMark label={false} />}
            </p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <MapPin className="size-3" /> {listing.region?.name ?? p?.city}
              {distanceKm != null && <span>· {Math.round(distanceKm)} km</span>}
            </p>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted" title="Available volume">
            <CalendarClock className="size-3.5" />
            {new Intl.NumberFormat("en-CA", { notation: "compact" }).format(listing.volume)} {listing.unit}
          </span>
        </div>
      </div>
    </article>
  );
}

export function ListingGrid({ items }: { items: (ListingCardData & { distanceKm?: number | null })[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((l) => (
        <ListingCard key={l.id} listing={l} distanceKm={l.distanceKm} />
      ))}
    </div>
  );
}
