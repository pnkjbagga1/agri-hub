import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { CommunityLayout, Feed } from "@/components/community";

export default async function SpacePage({ params }: { params: Promise<{ space: string }> }) {
  const { space } = await params;
  const s = await db.space.findUnique({ where: { slug: space } });
  if (!s) notFound();
  const user = await getSessionUser();
  return (
    <CommunityLayout user={user} activeSlug={s.slug}>
      <Feed spaceId={s.id} user={user} />
    </CommunityLayout>
  );
}
