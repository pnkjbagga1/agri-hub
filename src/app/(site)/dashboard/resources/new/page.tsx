import type { Metadata } from "next";
import { requireRole } from "@/server/guards";
import { ResourceForm } from "@/components/forms/Posting";
import { PageHeader } from "@/components/ui";
import { PARTNER_ROLES } from "@/lib/constants";

export const metadata: Metadata = { title: "Post a program" };

export default async function NewResourcePage() {
  await requireRole(PARTNER_ROLES);
  return (
    <>
      <PageHeader eyebrow="Partner" title="Post a program or offer" subtitle="Write it in plain language — growers can express interest in one click and you'll get the lead in your dashboard." />
      <ResourceForm />
    </>
  );
}
