import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/server/guards";
import { ChangePassword, SessionsAndEmail, TwoFactor } from "@/components/SecurityForms";
import { SessionsList } from "@/components/SessionsList";
import { PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Account & security" };

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  const sessions = await db.session.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" }, take: 20 });
  return (
    <div className="container-page max-w-3xl py-10">
      <PageHeader eyebrow="Account" title="Account & security" subtitle={`Last sign-in: ${formatDateTime(user.lastLoginAt)}`} />
      <div className="space-y-6">
        <SessionsAndEmail verified={!!user.emailVerifiedAt} email={user.email} />
        <TwoFactor enabled={user.totpEnabled} />
        <SessionsList sessions={sessions.map((s) => ({ id: s.id, userAgent: s.userAgent, ip: s.ip, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString(), current: s.id === user.sessionId }))} />
        <ChangePassword />
      </div>
    </div>
  );
}
