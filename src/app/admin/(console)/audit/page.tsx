import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  const logs = await db.auditLog.findMany({ include: { actor: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <>
      <PageHeader eyebrow="Security" title="Audit log" subtitle="Sign-ins, lockouts, password changes, two-factor changes and every moderation/admin action. Most recent 300." />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line bg-cream text-xs text-muted uppercase">
            <tr>
              <th className="px-5 py-3">When</th>
              <th className="px-3 py-3">Actor</th>
              <th className="px-3 py-3">Action</th>
              <th className="px-3 py-3">Target</th>
              <th className="px-5 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="px-5 py-2 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                <td className="px-3 py-2">{l.actor?.email ?? "system"}</td>
                <td className="px-3 py-2 font-mono text-xs">{l.action}</td>
                <td className="px-3 py-2 text-xs text-muted">{l.targetType ? `${l.targetType}:${l.targetId ?? ""}` : "—"}</td>
                <td className="max-w-xs truncate px-5 py-2 font-mono text-xs text-muted">{l.meta ? JSON.stringify(l.meta) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
