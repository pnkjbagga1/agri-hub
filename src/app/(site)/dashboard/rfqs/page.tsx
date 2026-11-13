import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { requireOnboarded } from "@/server/guards";
import { ButtonLink, EmptyState, PageHeader, Pill } from "@/components/ui";
import { formatDate, formatMoney, formatNumber, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "RFQs & quotes" };

const TONE = { open: "neutral", quoted: "gold", accepted: "green", declined: "red", withdrawn: "neutral" } as const;

type Rfqs = Awaited<ReturnType<typeof loadRfqs>>;

function loadRfqs(where: { growerId: string } | { buyerId: string }) {
  return db.rfq.findMany({ where, orderBy: { createdAt: "desc" }, include: { listing: { select: { title: true } }, buyer: { select: { profile: { select: { orgName: true } } } }, grower: { select: { profile: { select: { orgName: true } } } } } });
}

function RfqTable({ rows, asGrower }: { rows: Rfqs; asGrower: boolean }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[15px]">
        <thead className="border-b border-line bg-cream text-xs text-muted uppercase">
          <tr>
            <th className="px-5 py-3">Listing</th>
            <th className="px-3 py-3">{asGrower ? "Buyer" : "Grower"}</th>
            <th className="px-3 py-3">Quantity</th>
            <th className="px-3 py-3">Delivery</th>
            <th className="px-3 py-3">Price</th>
            <th className="px-5 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-cream">
              <td className="px-5 py-3">
                <Link href={`/messages/${r.threadId}`} className="font-semibold hover:text-leaf">
                  {r.listing?.title ?? "RFQ"}
                </Link>
                <p className="text-xs text-muted">{timeAgo(r.createdAt)}</p>
              </td>
              <td className="px-3 py-3">{(asGrower ? r.buyer : r.grower).profile?.orgName}</td>
              <td className="px-3 py-3 whitespace-nowrap">
                {formatNumber(r.quantity)} {r.unit}
              </td>
              <td className="px-3 py-3 whitespace-nowrap">{formatDate(r.deliveryDate)}</td>
              <td className="px-3 py-3 whitespace-nowrap">{r.quotePrice != null ? `${formatMoney(r.quotePrice)} quoted` : r.targetPrice != null ? `${formatMoney(r.targetPrice)} target` : "—"}</td>
              <td className="px-5 py-3">
                <Pill tone={TONE[r.status]}>{r.status}</Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function RfqsPage() {
  const user = await requireOnboarded("/dashboard/rfqs");
  const asGrower = user.role === "grower";
  const rfqs = await loadRfqs(asGrower ? { growerId: user.id } : { buyerId: user.id });
  const open = rfqs.filter((r) => r.status === "open" || r.status === "quoted");
  const closed = rfqs.filter((r) => !(r.status === "open" || r.status === "quoted"));
  return (
    <>
      <PageHeader eyebrow={asGrower ? "Grower" : "Buyer"} title={asGrower ? "RFQs & quotes" : "My RFQs"} subtitle={asGrower ? "Respond quickly — buyers compare quotes from multiple growers." : "Track quotes from growers. Accept a quote from the conversation."} />
      {rfqs.length === 0 ? (
        <EmptyState icon={<FileText className="size-7" />} title="No RFQs yet" body={asGrower ? "When buyers request quotes on your listings they appear here." : "Open any listing and choose “Send Inquiry / RFQ”."} action={!asGrower ? <ButtonLink href="/marketplace">Browse produce</ButtonLink> : undefined} />
      ) : (
        <div className="space-y-8">
          {open.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl">Active ({open.length})</h2>
              <RfqTable rows={open} asGrower={asGrower} />
            </section>
          )}
          {closed.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl">History</h2>
              <RfqTable rows={closed} asGrower={asGrower} />
            </section>
          )}
        </div>
      )}
    </>
  );
}
