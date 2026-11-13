import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { CommentForm, LikeButton } from "@/components/actions";
import { ReportButton } from "@/components/listings/ListingActions";
import { Avatar, RoleBadge } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const p = await db.post.findUnique({
    where: { id },
    include: {
      space: true,
      author: { select: { role: true, profile: { select: { orgName: true, photoUrl: true, slug: true } } } },
      comments: { where: { isHidden: false }, orderBy: { createdAt: "asc" }, include: { author: { select: { role: true, profile: { select: { orgName: true, photoUrl: true, slug: true } } } } } },
      _count: { select: { reactions: true } },
    },
  });
  if (!p || (p.isHidden && user?.role !== "admin")) notFound();
  const liked = user ? !!(await db.reaction.findUnique({ where: { postId_userId: { postId: p.id, userId: user.id } } })) : false;
  return (
    <div className="container-page max-w-3xl py-10">
      <Link href={`/community/${p.space.slug}`} className="text-sm font-semibold text-leaf hover:underline">
        ← {p.space.name}
      </Link>
      <article className="card mt-4 p-6">
        <div className="flex items-center gap-3">
          <Avatar src={p.author.profile?.photoUrl} name={p.author.profile?.orgName ?? "GRIS Canada"} size={46} rounded="rounded-xl" />
          <div>
            {p.author.profile ? (
              <Link href={`/directory/${p.author.profile.slug}`} className="font-bold hover:text-leaf">
                {p.author.profile.orgName}
              </Link>
            ) : (
              <span className="font-bold">GRIS Canada</span>
            )}
            <div className="flex items-center gap-2 text-sm text-muted">
              <RoleBadge role={p.author.role} /> {timeAgo(p.createdAt)}
            </div>
          </div>
        </div>
        {p.title && <h1 className="mt-5 text-2xl sm:text-3xl">{p.title}</h1>}
        <p className="mt-3 leading-relaxed whitespace-pre-line text-ink-soft">{p.body}</p>
        <div className="mt-5 flex items-center justify-between">
          <LikeButton postId={p.id} liked={liked} count={p._count.reactions} signedIn={!!user} />
          <ReportButton targetType="post" targetId={p.id} signedIn={!!user} />
        </div>
      </article>
      <section className="mt-6">
        <h2 className="mb-4 text-lg">
          {p.comments.length} {p.comments.length === 1 ? "reply" : "replies"}
        </h2>
        <ul className="space-y-3">
          {p.comments.map((c) => (
            <li key={c.id} className="card flex gap-3 p-4">
              <Avatar src={c.author.profile?.photoUrl} name={c.author.profile?.orgName ?? "?"} size={34} rounded="rounded-lg" />
              <div className="min-w-0">
                <p className="text-sm">
                  <Link href={`/directory/${c.author.profile?.slug}`} className="font-bold hover:text-leaf">
                    {c.author.profile?.orgName ?? "GRIS Canada"}
                  </Link>{" "}
                  <span className="text-muted">· {timeAgo(c.createdAt)}</span>
                </p>
                <p className="mt-1 whitespace-pre-line text-ink-soft">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          {user ? (
            <CommentForm postId={p.id} />
          ) : (
            <p className="text-muted">
              <Link href={`/login?next=/community/post/${p.id}`} className="font-semibold text-leaf">
                Sign in
              </Link>{" "}
              to reply.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
