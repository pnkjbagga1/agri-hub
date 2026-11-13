import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/guards";
import { AdminNav } from "@/components/admin/AdminNav";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · AGRI HUB Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [pendingListings, pendingResources, pendingEvents, pendingDemand, pendingCerts, openReports] = await Promise.all([
    db.listing.count({ where: { approval: "pending", status: { not: "archived" } } }),
    db.resource.count({ where: { approval: "pending" } }),
    db.event.count({ where: { approval: "pending" } }),
    db.demandPost.count({ where: { approval: "pending" } }),
    db.certificationDoc.count({ where: { status: "pending" } }),
    db.report.count({ where: { status: "open" } }),
  ]);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <AdminNav counts={{ approvals: pendingListings + pendingResources + pendingEvents + pendingDemand + pendingCerts, reports: openReports }} email={user.email} />
      <main id="main" className="min-w-0 px-4 py-8 sm:px-8">
        {!user.totpEnabled && (
          <Notice tone="warn" className="mb-6">
            Two-factor authentication is off for this admin account. <Link href="/admin/security" className="font-semibold underline">Turn it on now</Link>.
          </Notice>
        )}
        {children}
      </main>
    </div>
  );
}
