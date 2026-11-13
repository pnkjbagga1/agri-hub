import Link from "next/link";
import { MapPin } from "lucide-react";
import type { ProfileCardData } from "@/server/queries";
import { Avatar, Pill, RoleBadge, VerifiedMark } from "@/components/ui";

export function ProfileCard({ p }: { p: ProfileCardData }) {
  return (
    <article className="card group relative flex flex-col items-center p-5 text-center transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      {p.isFeatured && <span className="absolute top-3 right-3 text-[11px] font-bold text-[#7a5a12]">★ Featured</span>}
      <Avatar src={p.photoUrl} name={p.orgName} size={76} rounded="rounded-2xl" />
      <h3 className="mt-3 line-clamp-2 font-sans text-[15px] leading-snug font-bold">
        <Link href={`/directory/${p.slug}`} className="after:absolute after:inset-0">
          {p.orgName}
        </Link>
      </h3>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
        <RoleBadge role={p.user.role} />
        {p.user.isVerified && <VerifiedMark />}
      </div>
      {p.tagline && <p className="mt-2 line-clamp-2 text-sm text-muted">{p.tagline}</p>}
      <p className="mt-auto flex items-center gap-1 pt-3 text-xs text-muted">
        <MapPin className="size-3" />
        {[p.city, p.region?.name].filter(Boolean).join(" · ")}
      </p>
      <span className="mt-3 text-sm font-semibold text-primary">View profile / Connect →</span>
    </article>
  );
}

export function UnclaimedPill() {
  return <Pill tone="gold">Unclaimed profile</Pill>;
}
