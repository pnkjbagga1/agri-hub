import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, fail, zReqText } from "@/server/api";
import { assertCanAct } from "@/server/rules";
import { notify, audit } from "@/server/notify";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("comment"), body: zReqText(3000) }),
  z.object({ action: z.literal("react") }),
  z.object({ action: z.literal("pin"), pinned: z.boolean() }),
]);

export const POST = handler<{ id: string }>({ auth: true, rateLimit: [90, 600], name: "post-act" }, async ({ req, params, user }) => {
  const post = await db.post.findUnique({ where: { id: params.id } });
  if (!post || post.isHidden) fail(404, "Post not found.");
  const d = await body(req, schema);
  if (d.action === "comment") {
    await assertCanAct(user);
    const c = await db.comment.create({ data: { postId: post!.id, authorId: user.id, body: d.body } });
    if (post!.authorId !== user.id) await notify(post!.authorId, { type: "comment", title: `${user.profile?.orgName ?? "Someone"} commented on your post`, body: d.body.slice(0, 120), link: `/community/post/${post!.id}` });
    return { ok: true, id: c.id };
  }
  if (d.action === "react") {
    const key = { postId_userId: { postId: post!.id, userId: user.id } };
    const had = await db.reaction.findUnique({ where: key });
    if (had) await db.reaction.delete({ where: key });
    else await db.reaction.create({ data: { postId: post!.id, userId: user.id } });
    return { liked: !had, count: await db.reaction.count({ where: { postId: post!.id } }) };
  }
  if (user.role !== "admin") fail(403, "Only moderators can pin posts.");
  await db.post.update({ where: { id: post!.id }, data: { isPinned: d.pinned } });
  return { ok: true };
});

export const DELETE = handler<{ id: string }>({ auth: true }, async ({ params, user }) => {
  const post = await db.post.findUnique({ where: { id: params.id } });
  if (!post || (post.authorId !== user.id && user.role !== "admin")) fail(404, "Not found.");
  await db.post.delete({ where: { id: params.id } });
  if (user.role === "admin" && post!.authorId !== user.id) await audit(user.id, "post.delete", "post", params.id);
  return { ok: true };
});
