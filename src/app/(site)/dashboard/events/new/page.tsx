import type { Metadata } from "next";
import { requireRole } from "@/server/guards";
import { EventForm } from "@/components/forms/Posting";
import { PageHeader } from "@/components/ui";
import { PARTNER_ROLES } from "@/lib/constants";

export const metadata: Metadata = { title: "Host an event" };

export default async function NewEventPage() {
  await requireRole(PARTNER_ROLES);
  return (
    <>
      <PageHeader eyebrow="Partner" title="Host an event" subtitle="Events are reviewed by GRIS Canada and then listed on the community calendar." />
      <EventForm />
    </>
  );
}
