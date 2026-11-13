import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { UserActions, Moderate } from "@/components/admin/AdminActions";
import { Avatar, PageHeader, Pill, RoleBadge, StatCard } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "User" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await db.user.findUnique({ where: { id }, include: { profile: true, _count: { select: { listings: true, rfqsSent: true, rfqsReceived: true, messages: true, reports: true } } } });
  if (!u) notFound();
  const logs = await db.auditLog.findMany({ where: { OR: [{ actorId: id }, { targetId: id }] }, orderBy: { createdAt: "desc" }, take: 25 });
  return (
    <>
      <PageHeader eyebrow="User" title={u.profile?.orgName ?? u.email} subtitle={<span className="flex flex-wrap items-center gap-2"><RoleBadge role={u.role} /> {u.email} <Pill tone={u.status === "active" ? "green" : "red"}>{u.status}</Pill></span>} />
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar src={u.profile?.photoUrl} name={u.profile?.orgName ?? u.email} size={72} />
        <UserActions id={u.id} status={u.status} verified={u.isVerified} emailVerified={!!u.emailVerifiedAt} />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Listings" value={u._count.listings} />
        <StatCard label="RFQs sent" value={u._count.rfqsSent} />
        <StatCard label="RFQs received" value={u._count.rfqsReceived} />
        <StatCard label="Messages" value={u._count.messages} />
        <StatCard label="Reports filed" value={u._count.reports} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card space-y-2 p-6 text-sm">
          <h2 className="mb-2 text-lg">Account</h2>
          <p>Email confirmed: <strong>{u.emailVerifiedAt ? formatDateTime(u.emailVerifiedAt) : "no"}</strong></p>
          <p>Two-factor: <strong>{u.totpEnabled ? "on" : "off"}</strong></p>
          <p>Last sign-in: <strong>{formatDateTime(u.lastLoginAt)}</strong></p>
          <p>Failed sign-ins: <strong>{u.failedLogins}</strong> {u.lockedUntil && u.lockedUntil > new Date() && <Pill tone="red">locked until {formatDateTime(u.lockedUntil)}</Pill>}</p>
          <p>Password changed: <strong>{formatDateTime(u.passwordChangedAt)}</strong></p>
          <p>Phone: <strong>{u.phone ?? "—"}</strong></p>
          {u.profile && (
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <Link href={`/directory/${u.profile.slug}`} className="font-semibold text-leaf" target="_blank">
                Public profile ↗
              </Link>
              <Pill>{u.profile.approval}</Pill>
              <Moderate type="profile" id={u.profile.id} approval={u.profile.approval} featured={u.profile.isFeatured} />
            </div>
          )}
        </section>
        <section className="card p-6">
          <h2 className="mb-3 text-lg">Recent activity (audit)</h2>
          <ul className="space-y-2 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span className="font-mono text-xs">{l.action}</span>
                <span className="text-muted">{formatDateTime(l.createdAt)}</span>
              </li>
            ))}
            {logs.length === 0 && <li className="text-muted">No activity yet.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
