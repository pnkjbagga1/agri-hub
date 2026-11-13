import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { db } from "@/lib/db";
import { requireOnboarded } from "@/server/guards";
import { Avatar, ButtonLink, EmptyState } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await requireOnboarded("/messages");
  const threads = await db.thread.findMany({
    where: { participants: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      listing: { select: { title: true, photos: true } },
      participants: { include: { user: { select: { id: true, profile: { select: { orgName: true, photoUrl: true } } } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return (
    <div className="container-page max-w-4xl py-10">
      <p className="eyebrow text-leaf!">Inbox</p>
      <h1 className="mt-2 mb-6 text-3xl sm:text-4xl">Messages</h1>
      {threads.length === 0 ? (
        <EmptyState icon={<MessageSquare className="size-7" />} title="No conversations yet" body="Message a grower from any listing, or connect with partners in the directory." action={<ButtonLink href="/marketplace">Browse the marketplace</ButtonLink>} />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {threads.map((t) => {
            const me = t.participants.find((p) => p.userId === user.id);
            const other = t.participants.find((p) => p.userId !== user.id)?.user;
            const last = t.messages[0];
            const unread = !!last && last.senderId !== user.id && (!me?.lastReadAt || last.createdAt > me.lastReadAt);
            return (
              <li key={t.id}>
                <Link href={`/messages/${t.id}`} className={cn("flex items-center gap-4 p-4 transition hover:bg-cream", unread && "bg-highlight-soft/40")}>
                  <Avatar src={other?.profile?.photoUrl} name={other?.profile?.orgName ?? "Member"} size={48} rounded="rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className={cn("truncate", unread ? "font-black" : "font-semibold")}>{other?.profile?.orgName ?? "Member"}</p>
                      <span className="shrink-0 text-xs text-muted">{last ? timeAgo(last.createdAt) : ""}</span>
                    </div>
                    {(t.listing?.title || t.subject) && <p className="truncate text-xs font-semibold text-leaf">{t.listing?.title ?? t.subject}</p>}
                    <p className={cn("truncate text-sm", unread ? "text-ink" : "text-muted")}>
                      {last?.senderId === user.id && "You: "}
                      {last?.body}
                    </p>
                  </div>
                  {unread && <span className="size-2.5 shrink-0 rounded-full bg-highlight" aria-label="Unread" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
