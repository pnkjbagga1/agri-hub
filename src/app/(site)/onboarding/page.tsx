import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/guards";
import { ProfileForm } from "@/components/forms/ProfileForm";
import { Notice, RoleBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  if (user.role === "admin") redirect("/admin");
  const p = user.profile!;
  const regions = await db.region.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  const done = !!p.photoUrl;
  return (
    <div className="container-page max-w-3xl py-10">
      <p className="eyebrow text-leaf!">Step 2 of 2 · Profile setup</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">{done ? "Your profile" : `Welcome, ${p.contactName ?? p.orgName}!`}</h1>
      <div className="mt-2 flex items-center gap-2 text-muted">
        Joining as <RoleBadge role={user.role} />
      </div>
      {!user.emailVerifiedAt && (
        <Notice tone="info" className="mt-5">
          We sent a confirmation link to <strong>{user.email}</strong>. You can keep setting up while you wait.
        </Notice>
      )}
      <div className="mt-8">
        <ProfileForm
          onboarding
          redirectTo={user.role === "grower" ? "/dashboard/listings/new?welcome=1" : "/dashboard?welcome=1"}
          role={user.role}
          regions={regions}
          initial={{ ...p, specialties: p.specialties, certifications: p.certifications, phone: user.phone }}
        />
      </div>
    </div>
  );
}
