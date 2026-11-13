import type { Metadata } from "next";
import { getSessionUser } from "@/server/session";
import { CommunityLayout, Feed } from "@/components/community";

export const metadata: Metadata = { title: "Community" };

export default async function CommunityPage() {
  const user = await getSessionUser();
  return (
    <CommunityLayout user={user}>
      <Feed user={user} />
    </CommunityLayout>
  );
}
