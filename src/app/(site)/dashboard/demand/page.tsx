import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/server/guards";
import { ToggleDemand } from "@/components/DashboardBits";
import { ButtonLink, EmptyState, Notice, PageHeader, Pill } from "@/components/ui";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "My demand posts" };

export default async function MyDemandPage({ searchParams }: { searchParams: Promise<{ posted?: string }> }) {
  const user = await requireRole(["buyer"]);
  const { posted } = await searchParams;
  const posts = await db.demandPost.findMany({ where: { buyerId: user.id }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader eyebrow="Buyer" title="Demand posts" subtitle="Tell growers what you need. Matching growers are notified instantly." actions={<ButtonLink href="/dashboard/demand/new" variant="gold"><Megaphone className="size-4" /> Post a need</ButtonLink>} />
      {posted && <Notice tone="success" className="mb-6">Posted! Growers with matching produce have been notified.</Notice>}
      {posts.length === 0 ? (
        <EmptyState icon={<Megaphone className="size-7" />} title="No demand posts yet" action={<ButtonLink href="/dashboard/demand/new">Post your first need</ButtonLink>} />
      ) : (
        <ul className="card divide-y divide-line">
          {posts.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/demand/${d.id}`} className="font-semibold hover:text-leaf">
                  {d.title}
                </Link>
                <p className="text-sm text-muted">
                  {formatNumber(d.quantity)} {d.unit} · needed by {formatDate(d.neededBy)}
                </p>
              </div>
              <Pill tone={d.isOpen ? "green" : "neutral"}>{d.isOpen ? "open" : "closed"}</Pill>
              {d.approval !== "approved" && <Pill tone={d.approval === "rejected" ? "red" : "neutral"}>{d.approval === "pending" ? "in review" : d.approval}</Pill>}
              <ToggleDemand id={d.id} isOpen={d.isOpen} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
