import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { Avatar, ButtonLink, EmptyState, Pill } from "@/components/ui";
import { RESOURCE_LABEL, RESOURCE_TYPES } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Programs, funding & resources", description: "Grants, financing, export support, courses, research and ag-tech demos for BC growers — from EDC, FCC, BC and federal government, universities and partners." };

type SP = { type?: string | string[]; q?: string };

/** Deadline within the next 30 days. */
function soon(d: Date | null) {
  const now = Date.now();
  return !!d && d.getTime() > now && d.getTime() - now < 30 * 86400000;
}

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const types = (Array.isArray(sp.type) ? sp.type : sp.type ? [sp.type] : []).filter((t) => RESOURCE_TYPES.some((r) => r.key === t));
  const q = sp.q?.trim().slice(0, 80);
  const items = await db.resource.findMany({
    where: {
      approval: "approved",
      ...(types.length ? { type: { in: types as never[] } } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { summary: { contains: q, mode: "insensitive" } }, { tags: { has: q.toLowerCase() } }] } : {}),
    },
    include: { profile: { select: { orgName: true, slug: true, photoUrl: true } }, _count: { select: { interests: true } } },
    orderBy: [{ isFeatured: "desc" }, { deadline: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });
  return (
    <div className="container-page py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-leaf!">Funding, grants & partner programs</p>
          <h1 className="mt-2 text-3xl sm:text-[2.6rem]">Programs hub</h1>
          <p className="mt-2 max-w-2xl text-muted">Grants, loans, export support, courses, research partnerships and ag-tech trials — explained in plain language, with one-click expressions of interest.</p>
        </div>
        <ButtonLink href="/dashboard/resources/new" variant="gold">
          Partners: post a program
        </ButtonLink>
      </div>
      <form className="mb-4" role="search">
        {types.map((t) => (
          <input key={t} type="hidden" name="type" value={t} />
        ))}
        <input name="q" defaultValue={q} className="input h-12 rounded-full! px-5" placeholder="Search programs — e.g. young farmer, export, irrigation" aria-label="Search programs" />
      </form>
      <nav className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Program types">
        <Link href="/resources" className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset", !types.length ? "bg-primary text-white ring-primary" : "bg-white ring-line")}>
          All
        </Link>
        {RESOURCE_TYPES.map((t) => (
          <Link key={t.key} href={`/resources?type=${t.key}`} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset", types.length === 1 && types[0] === t.key ? "bg-primary text-white ring-primary" : "bg-white ring-line")}>
            {t.label}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState icon={<ClipboardList className="size-7" />} title="No programs found" body="Try another type or search term." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((r) => (
            <Link key={r.id} href={`/resources/${r.id}`} className="card flex flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="green">{RESOURCE_LABEL[r.type]}</Pill>
                {r.isFeatured && <Pill tone="gold">★ Featured</Pill>}
                {soon(r.deadline) && (
                  <Pill tone="red">
                    <Clock className="size-3" /> Closing soon
                  </Pill>
                )}
              </div>
              <h2 className="mt-3 text-lg leading-snug">{r.title}</h2>
              <p className="mt-2 line-clamp-3 text-[15px] text-muted">{r.summary}</p>
              {r.amount && <p className="mt-2 text-sm font-bold text-leaf">{r.amount}</p>}
              <div className="mt-auto flex items-center gap-2 pt-5 text-sm">
                <Avatar src={r.profile.photoUrl} name={r.profile.orgName} size={28} rounded="rounded-lg" />
                <span className="min-w-0 truncate font-semibold">{r.profile.orgName}</span>
                <span className="ml-auto shrink-0 text-xs text-muted">{r.deadline ? `Deadline ${formatDate(r.deadline, { month: "short", day: "numeric" })}` : `${r._count.interests} interested`}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
