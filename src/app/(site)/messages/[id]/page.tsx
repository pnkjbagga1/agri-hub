import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOnboarded } from "@/server/guards";
import { ThreadView } from "@/components/ThreadView";
import { RfqPanel } from "@/components/RfqPanel";
import { ReportButton } from "@/components/listings/ListingActions";
import { Avatar, RoleBadge } from "@/components/ui";
import { asset } from "@/lib/paths";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversation" };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireOnboarded(`/messages/${id}`);
  const t = await db.thread.findUnique({
    where: { id },
    include: {
      listing: { select: { id: true, title: true, slug: true, photos: true, price: true, priceUnit: true, unit: true } },
      participants: { include: { user: { select: { id: true, role: true, profile: { select: { orgName: true, photoUrl: true, slug: true } } } } } },
      messages: { orderBy: { createdAt: "asc" }, take: 300 },
      rfqs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!t || !t.participants.some((p) => p.userId === user.id)) notFound();
  // mark read on open
  await db.threadParticipant.update({ where: { threadId_userId: { threadId: t.id, userId: user.id } }, data: { lastReadAt: new Date() } });
  await db.notification.updateMany({ where: { userId: user.id, readAt: null, link: `/messages/${t.id}` }, data: { readAt: new Date() } });
  const other = t.participants.find((p) => p.userId !== user.id);
  const names = Object.fromEntries(t.participants.map((p) => [p.userId, p.user.profile?.orgName ?? "GRIS Canada"]));
  return (
    <div className="container-page py-8">
      <Link href="/messages" className="tap text-sm font-semibold text-leaf hover:underline">
        ← All messages
      </Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line bg-white p-4">
            <Avatar src={other?.user.profile?.photoUrl} name={other?.user.profile?.orgName ?? "Member"} size={42} rounded="rounded-xl" />
            <div className="min-w-0 flex-1">
              <Link href={`/directory/${other?.user.profile?.slug}`} className="block truncate font-bold hover:text-leaf">
                {other?.user.profile?.orgName}
              </Link>
              {other && <RoleBadge role={other.user.role} />}
            </div>
            <ReportButton targetType="user" targetId={other?.userId ?? ""} signedIn label="Report" />
          </div>
          <ThreadView
            threadId={t.id}
            me={user.id}
            names={names}
            initialOtherRead={other?.lastReadAt?.toISOString() ?? null}
            initial={t.messages.map((m) => ({ id: m.id, body: m.body, kind: m.kind, senderId: m.senderId, createdAt: m.createdAt.toISOString() }))}
          />
        </div>
        <aside className="space-y-4">
          {t.listing && (
            <Link href={`/marketplace/${t.listing.slug}`} className="card flex gap-3 p-3 hover:shadow-[var(--shadow-lift)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(t.listing.photos[0] ?? "/seed/greens-1.svg")} alt="" className="size-16 rounded-xl object-cover" />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-bold">{t.listing.title}</p>
                <p className="text-sm text-leaf">{t.listing.price != null ? `${formatMoney(t.listing.price)} / ${t.listing.priceUnit ?? t.listing.unit}` : "Price on request"}</p>
              </div>
            </Link>
          )}
          {t.rfqs.map((r) => (
            <RfqPanel
              key={r.id}
              role={r.growerId === user.id ? "grower" : "buyer"}
              rfq={{ ...r, deliveryDate: r.deliveryDate?.toISOString() ?? null }}
            />
          ))}
          <p className="text-xs text-muted">Keep negotiations on AGRI HUB so there&apos;s a record for both parties. Never share bank passwords or one-time codes in chat.</p>
        </aside>
      </div>
    </div>
  );
}
