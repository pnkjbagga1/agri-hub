import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ExternalLink, Globe, Mail, MapPin, Phone, Ruler } from "lucide-react";
import { db } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { getSettings, visibleApproval } from "@/server/settings";
import { listingCardInclude, ratingFor } from "@/server/queries";
import { track } from "@/server/notify";
import { ListingCard } from "@/components/listings/ListingCard";
import { ReportButton } from "@/components/listings/ListingActions";
import { ClaimButton, ContactButton, ReviewForm } from "@/components/actions";
import { Avatar, CertBadge, Notice, Pill, RoleBadge, Stars, VerifiedMark } from "@/components/ui";
import { BUYER_TYPES, RESOURCE_LABEL } from "@/lib/constants";
import { asset } from "@/lib/paths";
import { formatDate, timeAgo } from "@/lib/utils";

type P = { params: Promise<{ slug: string }> };

const load = (slug: string) => db.profile.findUnique({ where: { slug }, include: { region: true, user: { select: { id: true, role: true, isVerified: true, status: true, createdAt: true } } } });

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const p = await load((await params).slug);
  return p ? { title: p.orgName, description: p.tagline ?? p.bio?.slice(0, 160) } : {};
}

export default async function ProfilePage({ params }: P) {
  const { slug } = await params;
  const p = await load(slug);
  const viewer = await getSessionUser();
  const settings = await getSettings();
  if (!p || p.user.role === "admin") notFound();
  const own = viewer?.id === p.userId;
  const hidden = p.user.status !== "active" || p.approval === "rejected" || (settings.moderation === "pre" && p.approval !== "approved");
  if (hidden && !own && viewer?.role !== "admin") notFound();
  if (!own) {
    await db.profile.update({ where: { id: p.id }, data: { views: { increment: 1 } } });
    await track("profile_view", { userId: viewer?.id, profileId: p.id, ownerId: p.userId });
  }
  const [listings, resources, events, reviews, rating, traded] = await Promise.all([
    db.listing.findMany({ where: { growerId: p.userId, status: "active", ...(own || viewer?.role === "admin" ? { approval: { not: "rejected" as const } } : await visibleApproval()) }, include: listingCardInclude, orderBy: { createdAt: "desc" }, take: 9 }),
    db.resource.findMany({ where: { profileId: p.id, ...(own || viewer?.role === "admin" ? { approval: { not: "rejected" as const } } : { approval: "approved" as const }) }, orderBy: { createdAt: "desc" } }),
    db.event.findMany({ where: { hostProfileId: p.id, approval: "approved", startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } }),
    db.review.findMany({ where: { subjectId: p.userId, isHidden: false }, include: { author: { select: { profile: { select: { orgName: true, slug: true, photoUrl: true } } } } }, orderBy: { createdAt: "desc" }, take: 10 }),
    ratingFor(p.userId),
    viewer && !own ? db.rfq.count({ where: { OR: [{ buyerId: viewer.id, growerId: p.userId }, { buyerId: p.userId, growerId: viewer.id }] } }) : 0,
  ]);
  const next = `/directory/${p.slug}`;
  return (
    <div>
      <div className="h-40 bg-sand sm:h-56" style={p.coverUrl ? { backgroundImage: `url(${asset(p.coverUrl)})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
      <div className="container-page">
        <div className="-mt-14 flex flex-wrap items-end gap-5">
          <Avatar src={p.photoUrl} name={p.orgName} size={120} className="border-4 border-cream" rounded="rounded-[26px]" />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-3xl sm:text-4xl">{p.orgName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <RoleBadge role={p.user.role} />
              {p.buyerType && <Pill>{BUYER_TYPES.find((b) => b.key === p.buyerType)?.label}</Pill>}
              {p.user.isVerified && <VerifiedMark />}
              {!p.isClaimed && <Pill tone="gold">Unclaimed profile</Pill>}
              {(p.user.role === "grower" || rating.count > 0) && <Stars value={rating.avg} count={rating.count} />}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pb-1">
            {own ? (
              <Link href="/dashboard/profile" className="rounded-full bg-primary px-5 py-3 font-semibold text-white">
                Edit profile
              </Link>
            ) : p.isClaimed ? (
              <ContactButton recipientId={p.userId} name={p.orgName} signedIn={!!viewer} next={next} disabled={viewer?.role === "admin"} />
            ) : (
              <ClaimButton profileId={p.id} signedIn={!!viewer} next={next} />
            )}
          </div>
        </div>
        {!p.isClaimed && (
          <Notice tone="warn" className="mt-6">
            This directory entry was compiled by GRIS Canada from public information so growers can find this organisation. It is not managed by the organisation itself. Use their official website to contact them.
          </Notice>
        )}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-10">
            <section>
              {p.tagline && <p className="text-lg font-semibold text-ink-soft">{p.tagline}</p>}
              {p.bio && <p className="mt-3 leading-relaxed whitespace-pre-line text-ink-soft">{p.bio}</p>}
              {p.specialties.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.specialties.map((s) => (
                    <Pill key={s}>{s}</Pill>
                  ))}
                </div>
              )}
            </section>
            {listings.length > 0 && (
              <section>
                <h2 className="mb-4 text-2xl">Produce listings</h2>
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {listings.map((l) => (
                    <ListingCard key={l.id} listing={l} />
                  ))}
                </div>
              </section>
            )}
            {resources.length > 0 && (
              <section>
                <h2 className="mb-4 text-2xl">Programs, resources & offers</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {resources.map((r) => (
                    <Link key={r.id} href={`/resources/${r.id}`} className="card p-5 transition hover:shadow-[var(--shadow-lift)]">
                      <Pill tone="green">{RESOURCE_LABEL[r.type]}</Pill>
                      <p className="mt-2 font-bold">{r.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{r.summary}</p>
                      {r.deadline && <p className="mt-2 text-xs font-semibold text-danger">Deadline {formatDate(r.deadline)}</p>}
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {events.length > 0 && (
              <section>
                <h2 className="mb-4 text-2xl">Upcoming events</h2>
                <ul className="space-y-3">
                  {events.map((e) => (
                    <li key={e.id}>
                      <Link href={`/events/${e.id}`} className="card flex items-center gap-3 p-4 hover:shadow-[var(--shadow-lift)]">
                        <CalendarDays className="size-5 text-leaf" />
                        <span className="font-semibold">{e.title}</span>
                        <span className="ml-auto text-sm text-muted">{formatDate(e.startsAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {(reviews.length > 0 || traded > 0) && (
              <section>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-2xl">Reviews</h2>
                  {traded > 0 && <ReviewForm subjectId={p.userId} name={p.orgName} />}
                </div>
                {reviews.length === 0 ? (
                  <p className="text-muted">No reviews yet.</p>
                ) : (
                  <ul className="space-y-4">
                    {reviews.map((r) => (
                      <li key={r.id} className="card p-5">
                        <div className="flex items-center gap-3">
                          <Avatar src={r.author.profile?.photoUrl} name={r.author.profile?.orgName ?? "Member"} size={36} rounded="rounded-xl" />
                          <div>
                            <Link href={`/directory/${r.author.profile?.slug}`} className="font-semibold hover:text-leaf">
                              {r.author.profile?.orgName}
                            </Link>
                            <div className="flex items-center gap-2 text-xs text-muted">
                              <Stars value={r.rating} size={12} /> · {timeAgo(r.createdAt)}
                            </div>
                          </div>
                        </div>
                        {r.body && <p className="mt-3 text-ink-soft">{r.body}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
          <aside className="space-y-4">
            <div className="card space-y-3 p-5 text-[15px]">
              <h2 className="text-lg">Details</h2>
              {(p.city || p.region) && (
                <p className="flex gap-2">
                  <MapPin className="size-5 shrink-0 text-leaf" /> {[p.city, p.region?.name].filter(Boolean).join(", ")}
                </p>
              )}
              {p.website && (
                <a href={p.website} target="_blank" rel="noopener noreferrer nofollow" className="flex gap-2 break-all text-leaf hover:underline">
                  <Globe className="size-5 shrink-0" /> {p.website.replace(/^https?:\/\//, "")} <ExternalLink className="size-3.5" />
                </a>
              )}
              {p.isClaimed && viewer && p.publicEmail && (
                <a href={`mailto:${p.publicEmail}`} className="flex gap-2 break-all text-leaf hover:underline">
                  <Mail className="size-5 shrink-0" /> {p.publicEmail}
                </a>
              )}
              {p.isClaimed && viewer && p.publicPhone && (
                <p className="flex gap-2">
                  <Phone className="size-5 shrink-0 text-leaf" /> {p.publicPhone}
                </p>
              )}
              {p.farmSizeAcres && (
                <p className="flex gap-2">
                  <Ruler className="size-5 shrink-0 text-leaf" /> {p.farmSizeAcres} acres
                </p>
              )}
              {p.isClaimed && !viewer && <p className="text-sm text-muted">Sign in to see contact details.</p>}
              <p className="text-xs text-muted">Member since {formatDate(p.user.createdAt, { month: "long", year: "numeric" })}</p>
            </div>
            {p.certifications.length > 0 && (
              <div className="card p-5">
                <h2 className="mb-3 text-lg">Certifications</h2>
                <div className="flex flex-wrap gap-2">
                  {p.certifications.map((c) => (
                    <CertBadge key={c} cert={c} />
                  ))}
                </div>
              </div>
            )}
            <div className="text-right">
              <ReportButton targetType="profile" targetId={p.id} signedIn={!!viewer && !own} label="Report profile" />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
