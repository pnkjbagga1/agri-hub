import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { InterestButton } from "@/components/actions";
import { Avatar, Notice, Pill, RoleBadge, VerifiedMark } from "@/components/ui";
import { RESOURCE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Program details" };

export default async function ResourceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const r = await db.resource.findUnique({ where: { id }, include: { profile: { include: { user: { select: { role: true, isVerified: true } } } }, _count: { select: { interests: true } } } });
  const own = !!user && r?.profile.userId === user.id;
  if (!r || (r.approval !== "approved" && !own && user?.role !== "admin")) notFound();
  const mine = user ? await db.resourceInterest.findUnique({ where: { resourceId_userId: { resourceId: r.id, userId: user.id } } }) : null;
  return (
    <div className="container-page grid max-w-6xl gap-8 py-10 lg:grid-cols-[1fr_340px]">
      <div>
        <Link href="/resources" className="text-sm font-semibold text-leaf hover:underline">
          ← Programs hub
        </Link>
        {r.approval !== "approved" && <Notice tone="warn" className="mt-4">Status: {r.approval}. Visible to you and moderators only.</Notice>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill tone="green">{RESOURCE_LABEL[r.type]}</Pill>
          {r.tags.map((t) => (
            <Pill key={t}>{t}</Pill>
          ))}
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl">{r.title}</h1>
        <p className="mt-4 text-lg text-ink-soft">{r.summary}</p>
        {r.body && <div className="mt-6 leading-relaxed whitespace-pre-line text-ink-soft">{r.body}</div>}
        {r.eligibility && (
          <section className="card mt-8 p-6">
            <h2 className="text-lg">Eligibility</h2>
            <p className="mt-2 text-ink-soft">{r.eligibility}</p>
          </section>
        )}
        {!r.profile.isClaimed && <Notice tone="warn" className="mt-6">Summary compiled by GRIS Canada from public information. Always confirm current terms, amounts and deadlines on the official program page.</Notice>}
      </div>
      <aside className="space-y-4 lg:pt-10">
        <div className="card space-y-4 p-6">
          {r.amount && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase">Amount / terms</p>
              <p className="text-xl font-black text-leaf">{r.amount}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-muted uppercase">Deadline</p>
            <p className="font-bold">{r.deadline ? formatDate(r.deadline, { weekday: "short", month: "long", day: "numeric", year: "numeric" }) : "Ongoing / rolling intake"}</p>
          </div>
          <p className="text-sm text-muted">{r._count.interests} member(s) interested</p>
          {!own && <InterestButton resourceId={r.id} signedIn={!!user} next={`/resources/${r.id}`} already={!!mine} externalUrl={r.externalUrl} />}
          {r.externalUrl && !mine && (
            <a href={r.externalUrl} target="_blank" rel="noopener noreferrer" className="block text-sm font-semibold text-leaf hover:underline">
              Official program page ↗
            </a>
          )}
        </div>
        <Link href={`/directory/${r.profile.slug}`} className="card flex items-center gap-3 p-4 hover:shadow-[var(--shadow-lift)]">
          <Avatar src={r.profile.photoUrl} name={r.profile.orgName} size={48} rounded="rounded-xl" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-bold">
              <span className="truncate">{r.profile.orgName}</span> {r.profile.user.isVerified && <VerifiedMark label={false} />}
            </p>
            <RoleBadge role={r.profile.user.role} />
          </div>
        </Link>
      </aside>
    </div>
  );
}
