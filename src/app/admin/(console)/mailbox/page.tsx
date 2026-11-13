import { db } from "@/lib/db";
import { Notice, PageHeader, Pill } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Mailbox" };

/** Every transactional email the platform sends. Without SENDGRID_API_KEY this is where emails go (dev). */
export default async function MailboxPage() {
  const emails = await db.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <PageHeader eyebrow="Email" title="Outgoing mailbox" subtitle="Verification links, password resets, alerts and notifications." />
      {!process.env.SENDGRID_API_KEY && <Notice tone="info" className="mb-6">SendGrid isn&apos;t configured, so emails are stored here instead of being delivered. Add SENDGRID_API_KEY to send real email.</Notice>}
      <ul className="space-y-3">
        {emails.map((e) => (
          <li key={e.id}>
            <details className="card p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <span className="font-semibold">{e.subject}</span>
                <span className="text-sm text-muted">→ {e.to}</span>
                <Pill tone={e.status === "sent" ? "green" : e.status === "stored" ? "neutral" : "red"}>{e.status}</Pill>
                <span className="ml-auto text-xs text-muted">{formatDateTime(e.createdAt)}</span>
              </summary>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-cream p-3 text-sm whitespace-pre-wrap">{e.text}</pre>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
