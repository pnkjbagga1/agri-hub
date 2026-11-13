import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/server/guards";
import { MarkAllRead } from "@/components/MarkAllRead";
import { EmptyState } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <div className="container-page max-w-3xl py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-leaf!">Activity</p>
          <h1 className="mt-2 text-3xl sm:text-4xl">Notifications</h1>
        </div>
        {unread > 0 && <MarkAllRead />}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Bell className="size-7" />} title="You're all caught up" />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {items.map((n) => {
            const body = (
              <div className={cn("flex gap-3 p-4", !n.readAt && "bg-highlight-soft/40")}>
                <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-highlight")} />
                <div className="min-w-0 flex-1">
                  <p className={cn(!n.readAt && "font-bold")}>{n.title}</p>
                  {n.body && <p className="line-clamp-2 text-sm text-muted">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-cream">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
