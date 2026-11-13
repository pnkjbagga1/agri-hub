import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireOnboarded } from "@/server/guards";
import { ProfileForm } from "@/components/forms/ProfileForm";
import { CertDocs } from "@/components/DashboardBits";
import { ButtonLink, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const user = await requireOnboarded("/dashboard/profile");
  const p = user.profile!;
  const [regions, docs] = await Promise.all([db.region.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }), db.certificationDoc.findMany({ where: { profileId: p.id }, orderBy: { createdAt: "desc" } })]);
  return (
    <>
      <PageHeader eyebrow="Profile" title="Your public profile" actions={<ButtonLink href={`/directory/${p.slug}`} variant="outline">View public profile</ButtonLink>} />
      <div className="space-y-6">
        <ProfileForm role={user.role} regions={regions} initial={{ ...p, phone: user.phone }} />
        <CertDocs docs={docs.map((d) => ({ ...d, expiresAt: d.expiresAt?.toISOString() ?? null }))} />
      </div>
    </>
  );
}
