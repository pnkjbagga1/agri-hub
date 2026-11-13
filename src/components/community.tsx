import Link from "next/link";
import { MessageCircle, Pin, Lock } from "lucide-react";
import { db } from "@/lib/db";
import type { SessionUser } from "@/server/session";
import { LikeButton, PostComposer } from "@/components/actions";
import { Avatar, ButtonLink, EmptyState, RoleBadge } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";

export async function CommunityLayout({ user, activeSlug, children }: { user: SessionUser | null; activeSlug?: string; children: React.ReactNode }) {
  const spaces = await db.space.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { posts: true } } } });
  const postable = spaces.filter((s) => !s.isLocked || user?.role === "admin");
  const active = spaces.find((s) => s.slug === activeSlug);
  return (
    <div className="container-page py-10">
      <p className="eyebrow text-leaf!">Growers network & community</p>
      <h1 className="mt-2 text-3xl sm:text-[2.6rem]">{active?.name ?? "Community"}</h1>
      <p className="mt-2 max-w-2xl text-muted">{active?.description ?? "Bring what you know. Take what you need. Ask questions, share results and find partners across BC's agri-food ecosystem."}</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Spaces" className="-mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:px-0">
          <Link href="/community" className={cn("flex shrink-0 items-center justify-between gap-3 rounded-full px-4 py-2.5 text-sm font-semibold whitespace-nowrap lg:rounded-xl", !activeSlug ? "bg-primary text-white" : "hover:bg-sand")}>
            All discussions
          </Link>
          {spaces.map((s) => (
            <Link key={s.id} href={`/community/${s.slug}`} className={cn("flex shrink-0 items-center justify-between gap-3 rounded-full px-4 py-2.5 text-sm font-semibold whitespace-nowrap lg:rounded-xl", activeSlug === s.slug ? "bg-primary text-white" : "hover:bg-sand")}>
              <span className="flex items-center gap-1.5">
                {s.isLocked && <Lock className="size-3.5" />} {s.name}
              </span>
              <span className={activeSlug === s.slug ? "text-white/70" : "text-muted"}>{s._count.posts}</span>
            </Link>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">
          {user ? (
            postable.length > 0 && (!active || postable.some((s) => s.id === active.id)) && <PostComposer spaces={postable.map((s) => ({ id: s.id, name: s.name }))} defaultSpaceId={active?.id} />
          ) : (
            <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-muted">Join AGRI HUB to post and reply.</p>
              <ButtonLink href="/signup" size="sm" variant="gold">
                Join free
              </ButtonLink>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

export async function Feed({ spaceId, user }: { spaceId?: string; user: SessionUser | null }) {
  const posts = await db.post.findMany({
    where: { isHidden: false, ...(spaceId ? { spaceId } : {}) },
    include: { space: true, author: { select: { role: true, profile: { select: { orgName: true, photoUrl: true, slug: true } } } }, _count: { select: { comments: true, reactions: true } }, reactions: user ? { where: { userId: user.id }, select: { userId: true } } : false },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: 40,
  });
  if (!posts.length) return <EmptyState icon={<MessageCircle className="size-7" />} title="No discussions yet" body="Start the first one!" />;
  return (
    <ul className="space-y-4">
      {posts.map((p) => (
        <li key={p.id} className="card p-5">
          <div className="flex items-start gap-3">
            <Avatar src={p.author.profile?.photoUrl} name={p.author.profile?.orgName ?? "GRIS Canada"} size={42} rounded="rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-bold">{p.author.profile?.orgName ?? "GRIS Canada"}</span>
                <RoleBadge role={p.author.role} />
                <span className="text-muted">
                  in{" "}
                  <Link href={`/community/${p.space.slug}`} className="font-semibold text-leaf">
                    {p.space.name}
                  </Link>{" "}
                  · {timeAgo(p.createdAt)}
                </span>
                {p.isPinned && (
                  <span className="flex items-center gap-1 text-xs font-bold text-highlight">
                    <Pin className="size-3" /> Pinned
                  </span>
                )}
              </div>
              <Link href={`/community/post/${p.id}`} className="block">
                {p.title && <h2 className="mt-2 text-lg leading-snug hover:text-leaf">{p.title}</h2>}
                <p className="mt-1 line-clamp-4 whitespace-pre-line text-ink-soft">{p.body}</p>
              </Link>
              <div className="mt-3 flex items-center gap-2">
                <LikeButton postId={p.id} liked={Array.isArray(p.reactions) && p.reactions.length > 0} count={p._count.reactions} signedIn={!!user} />
                <Link href={`/community/post/${p.id}`} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted hover:bg-sand">
                  <MessageCircle className="size-4" /> {p._count.comments}
                </Link>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
