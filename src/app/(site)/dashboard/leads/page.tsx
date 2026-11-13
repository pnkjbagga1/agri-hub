import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/server/guards";
import { LeadStatus } from "@/components/DashboardBits";
import { Avatar, EmptyState, PageHeader, RoleBadge } from "@/components/ui";
import { PARTNER_ROLES } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage() {
  const user = await requireRole(PARTNER_ROLES);
  const leads = await db.resourceInterest.findMany({
    where: { resource: { profileId: user.profile!.id } },
    include: { resource: { select: { title: true, id: true } }, user: { select: { id: true, role: true, profile: { select: { orgName: true, slug: true, photoUrl: true, city: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <PageHeader eyebrow="Partner" title="Leads" subtitle="Members who expressed interest in your programs. Message them directly from their profile." />
      {leads.length === 0 ? (
        <EmptyState icon={<Users className="size-7" />} title="No leads yet" body="Post a program in plain language to start receiving expressions of interest." />
      ) : (
        <ul className="card divide-y divide-line">
          {leads.map((l) => (
            <li key={l.id} className="flex flex-wrap items-start gap-4 p-4">
              <Avatar src={l.user.profile?.photoUrl} name={l.user.profile?.orgName ?? "Member"} size={44} rounded="rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/directory/${l.user.profile?.slug}`} className="font-bold hover:text-leaf">
                    {l.user.profile?.orgName}
                  </Link>
                  <RoleBadge role={l.user.role} />
                  <span className="text-xs text-muted">
                    {l.user.profile?.city} · {timeAgo(l.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  Interested in{" "}
                  <Link href={`/resources/${l.resource.id}`} className="font-semibold text-leaf">
                    {l.resource.title}
                  </Link>
                </p>
                {l.message && <p className="mt-1 text-[15px] text-ink-soft">“{l.message}”</p>}
              </div>
              <LeadStatus id={l.id} status={l.status} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
