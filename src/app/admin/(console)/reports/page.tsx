import Link from "next/link";
import { db } from "@/lib/db";
import { ReportActions } from "@/components/admin/AdminActions";
import { EmptyState, PageHeader, Pill } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Reports & claims" };

async function targetLink(type: string, id: string) {
  switch (type) {
    case "listing": {
      const l = await db.listing.findUnique({ where: { id }, select: { slug: true, title: true } });
      return l ? { href: `/marketplace/${l.slug}`, label: l.title } : null;
    }
    case "profile":
    case "claim": {
      const p = await db.profile.findUnique({ where: { id }, select: { slug: true, orgName: true, userId: true } });
      return p ? { href: `/directory/${p.slug}`, label: p.orgName, admin: `/admin/users/${p.userId}` } : null;
    }
    case "user": {
      const u = await db.user.findUnique({ where: { id }, select: { email: true, profile: { select: { orgName: true } } } });
      return u ? { href: `/admin/users/${id}`, label: u.profile?.orgName ?? u.email } : null;
    }
    case "post":
      return { href: `/community/post/${id}`, label: "Community post" };
    case "demand":
      return { href: `/demand/${id}`, label: "Demand post" };
    default:
      return null;
  }
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const reports = await db.report.findMany({ where: show === "all" ? {} : { status: "open" }, include: { reporter: { select: { email: true, profile: { select: { orgName: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 });
  const links = await Promise.all(reports.map((r) => targetLink(r.targetType, r.targetId)));
  return (
    <>
      <PageHeader eyebrow="Trust & safety" title="Reports & profile claims" actions={<Link href={show === "all" ? "/admin/reports" : "/admin/reports?show=all"} className="text-sm font-semibold text-leaf">{show === "all" ? "Open only" : "Show all"}</Link>} />
      {reports.length === 0 ? (
        <EmptyState title="Nothing to review" body="No open reports or claim requests." />
      ) : (
        <ul className="space-y-3">
          {reports.map((r, i) => {
            const t = links[i] as { href: string; label: string; admin?: string } | null;
            return (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={r.targetType === "claim" ? "gold" : "red"}>{r.targetType === "claim" ? "Claim request" : `Report · ${r.targetType}`}</Pill>
                  <span className="font-semibold">{r.reason}</span>
                  <Pill tone={r.status === "open" ? "neutral" : "green"}>{r.status}</Pill>
                  <span className="ml-auto text-sm text-muted">{timeAgo(r.createdAt)}</span>
                </div>
                {t && (
                  <p className="mt-2 text-sm">
                    Target:{" "}
                    <Link href={t.href} target="_blank" className="font-semibold text-leaf">
                      {t.label} ↗
                    </Link>
                    {t.admin && (
                      <Link href={t.admin} className="ml-3 font-semibold text-leaf">
                        Manage account
                      </Link>
                    )}
                  </p>
                )}
                {r.details && <p className="mt-2 rounded-lg bg-cream p-3 text-sm whitespace-pre-line">{r.details}</p>}
                <p className="mt-2 text-xs text-muted">
                  From {r.reporter.profile?.orgName ?? "member"} ({r.reporter.email})
                </p>
                {r.targetType === "claim" && r.status === "open" && <p className="mt-2 text-xs text-muted">To approve a claim: verify the requester&apos;s work email, then transfer the profile (update the unclaimed account&apos;s email in the database or merge) and resolve.</p>}
                {r.resolution && <p className="mt-2 text-sm text-leaf">Resolution: {r.resolution}</p>}
                {r.status === "open" && (
                  <div className="mt-3">
                    <ReportActions id={r.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
