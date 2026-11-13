import { db } from "@/lib/db";
import { getSettings } from "@/server/settings";
import { RegionForm, SettingsForm, SpaceForm } from "@/components/admin/AdminActions";
import { PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const [s, spaces, regions] = await Promise.all([getSettings(), db.space.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { posts: true } } } }), db.region.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { listings: true, profiles: true } } } })]);
  return (
    <>
      <PageHeader eyebrow="Configuration" title="Settings" />
      <div className="grid gap-6 xl:grid-cols-2">
        <SettingsForm moderation={s.moderation} announcement={s.announcement} requireEmail={s.requireEmailVerificationToMessage} />
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-3 text-lg">Community spaces</h2>
            <ul className="space-y-2 text-sm">
              {spaces.map((x) => (
                <li key={x.id} className="flex items-center justify-between">
                  <span className="font-semibold">{x.name}</span>
                  <span className="flex gap-2">
                    {x.isLocked && <Pill tone="gold">admins only</Pill>}
                    <Pill>{x._count.posts} posts</Pill>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <SpaceForm />
        </div>
        <section className="card p-6">
          <h2 className="mb-3 text-lg">Regions</h2>
          <ul className="space-y-2 text-sm">
            {regions.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className="font-semibold">{r.name}</span> <span className="text-muted">{r.province}, {r.country}</span>
                </span>
                <span className="flex gap-2">
                  {!r.isActive && <Pill>inactive</Pill>}
                  <Pill tone="green">{r._count.listings} listings</Pill>
                  <Pill>{r._count.profiles} members</Pill>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <RegionForm />
      </div>
    </>
  );
}
