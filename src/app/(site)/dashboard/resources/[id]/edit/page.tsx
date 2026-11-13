import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/server/guards";
import { ResourceForm } from "@/components/forms/Posting";
import { PageHeader } from "@/components/ui";
import { PARTNER_ROLES } from "@/lib/constants";

export const metadata: Metadata = { title: "Edit program" };

export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(PARTNER_ROLES);
  const { id } = await params;
  const r = await db.resource.findUnique({ where: { id } });
  if (!r || r.profileId !== user.profile!.id) notFound();
  return (
    <>
      <PageHeader eyebrow="Partner" title="Edit program" />
      <ResourceForm initial={{ ...r, deadline: r.deadline?.toISOString().slice(0, 10) ?? null }} />
    </>
  );
}
