import Link from "next/link";
import { db } from "@/lib/db";
import { CertReview, Moderate } from "@/components/admin/AdminActions";
import { Avatar, EmptyState, PageHeader, Pill } from "@/components/ui";
import { CERT_LABEL, RESOURCE_LABEL, EVENT_LABEL, ROLE_LABELS, type RoleKey } from "@/lib/constants";
import { asset } from "@/lib/paths";
import { cn, formatDate, timeAgo } from "@/lib/utils";

export const metadata = { title: "Approvals" };

const TABS = [
  ["listings", "Listings"],
  ["profiles", "Profiles"],
  ["resources", "Programs"],
  ["events", "Events"],
  ["demand", "Demand"],
  ["certs", "Certificates"],
] as const;

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ tab?: string; show?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "listings";
  const all = sp.show === "all";
  const approvalWhere = all ? {} : { approval: "pending" as const };
  const [counts, rows] = await Promise.all([
    Promise.all([
      db.listing.count({ where: { approval: "pending", status: { not: "archived" } } }),
      db.profile.count({ where: { approval: "pending", photoUrl: { not: null } } }),
      db.resource.count({ where: { approval: "pending" } }),
      db.event.count({ where: { approval: "pending" } }),
      db.demandPost.count({ where: { approval: "pending" } }),
      db.certificationDoc.count({ where: { status: "pending" } }),
    ]),
    (async () => {
      switch (tab) {
        case "profiles":
          return (await db.profile.findMany({ where: { ...approvalWhere, photoUrl: { not: null }, user: { role: { not: "admin" } } }, include: { user: { select: { role: true, email: true, id: true } } }, orderBy: { createdAt: "desc" }, take: 100 })).map((p) => ({ id: p.id, type: "profile", title: p.orgName, sub: `${ROLE_LABELS[p.user.role as RoleKey]} · ${p.user.email}`, img: p.photoUrl, href: `/directory/${p.slug}`, approval: p.approval, featured: p.isFeatured, when: p.createdAt }));
        case "resources":
          return (await db.resource.findMany({ where: approvalWhere, include: { profile: { select: { orgName: true } } }, orderBy: { createdAt: "desc" }, take: 100 })).map((r) => ({ id: r.id, type: "resource", title: r.title, sub: `${RESOURCE_LABEL[r.type]} · ${r.profile.orgName}`, img: null, href: `/resources/${r.id}`, approval: r.approval, featured: r.isFeatured, when: r.createdAt }));
        case "events":
          return (await db.event.findMany({ where: approvalWhere, include: { host: { select: { orgName: true } } }, orderBy: { createdAt: "desc" }, take: 100 })).map((e) => ({ id: e.id, type: "event", title: e.title, sub: `${EVENT_LABEL[e.type]} · ${formatDate(e.startsAt)} · ${e.host?.orgName ?? "GRIS Canada"}`, img: e.coverUrl, href: `/events/${e.id}`, approval: e.approval, featured: undefined, when: e.createdAt }));
        case "demand":
          return (await db.demandPost.findMany({ where: approvalWhere, include: { buyer: { select: { profile: { select: { orgName: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 })).map((d) => ({ id: d.id, type: "demand", title: d.title, sub: `${d.quantity} ${d.unit} · ${d.buyer.profile?.orgName}`, img: null, href: `/demand/${d.id}`, approval: d.approval, featured: undefined, when: d.createdAt }));
        case "certs":
          return [];
        default:
          return (await db.listing.findMany({ where: { ...approvalWhere, status: { not: "archived" } }, include: { grower: { select: { profile: { select: { orgName: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 })).map((l) => ({ id: l.id, type: "listing", title: l.title, sub: `${l.grower.profile?.orgName} · ${l.status} · lot ${l.lotCode}`, img: l.photos[0] ?? null, href: `/marketplace/${l.slug}`, approval: l.approval, featured: l.isFeatured, when: l.createdAt }));
      }
    })(),
  ]);
  const certs = tab === "certs" ? await db.certificationDoc.findMany({ where: all ? {} : { status: "pending" }, include: { profile: { select: { orgName: true, slug: true } } }, orderBy: { createdAt: "desc" } }) : [];
  const countByTab: Record<string, number> = Object.fromEntries(TABS.map(([k], i) => [k, counts[i]!]));
  return (
    <>
      <PageHeader eyebrow="Moderation" title="Approvals queue" subtitle="Approve, reject (with a reason the member sees) or feature content. Every action is written to the audit log." />
      <nav className="mb-6 flex flex-wrap gap-2">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/admin/approvals?tab=${k}${all ? "&show=all" : ""}`} className={cn("rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset", tab === k ? "bg-primary text-white ring-primary" : "bg-white ring-line")}>
            {label} {countByTab[k] ? <span className="ml-1 rounded-full bg-highlight px-1.5 text-xs text-white">{countByTab[k]}</span> : null}
          </Link>
        ))}
        <Link href={`/admin/approvals?tab=${tab}${all ? "" : "&show=all"}`} className="ml-auto rounded-full px-4 py-2 text-sm font-semibold text-leaf">
          {all ? "Show pending only" : "Show all"}
        </Link>
      </nav>
      {tab === "certs" ? (
        certs.length === 0 ? (
          <EmptyState title="No certificates waiting" />
        ) : (
          <ul className="card divide-y divide-line">
            {certs.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {CERT_LABEL[c.type] ?? c.type} — <Link href={`/directory/${c.profile.slug}`} className="text-leaf">{c.profile.orgName}</Link>
                  </p>
                  <p className="text-sm text-muted">
                    Uploaded {timeAgo(c.createdAt)} {c.expiresAt && `· expires ${formatDate(c.expiresAt)}`} ·{" "}
                    <a href={asset(c.documentUrl)} target="_blank" rel="noopener noreferrer" className="font-semibold text-leaf underline">
                      Open document
                    </a>
                  </p>
                </div>
                <Pill tone={c.status === "verified" ? "green" : c.status === "rejected" ? "red" : "neutral"}>{c.status}</Pill>
                {c.status === "pending" && <CertReview id={c.id} />}
              </li>
            ))}
          </ul>
        )
      ) : rows.length === 0 ? (
        <EmptyState title="Queue is clear 🎉" body="Nothing waiting for review in this category." />
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-4 p-4">
              {r.img ? <Avatar src={r.img} name={r.title} size={52} rounded="rounded-xl" /> : <span className="size-13 rounded-xl bg-sand" />}
              <div className="min-w-0 flex-1">
                <Link href={r.href} target="_blank" className="font-semibold hover:text-leaf">
                  {r.title}
                </Link>
                <p className="text-sm text-muted">
                  {r.sub} · {timeAgo(r.when)}
                </p>
              </div>
              <Pill tone={r.approval === "approved" ? "green" : r.approval === "rejected" ? "red" : "neutral"}>{r.approval}</Pill>
              <Moderate type={r.type} id={r.id} approval={r.approval} featured={r.featured} allowFeature={r.featured !== undefined} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
