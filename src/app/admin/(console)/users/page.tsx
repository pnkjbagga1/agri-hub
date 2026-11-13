import Link from "next/link";
import { db } from "@/lib/db";
import { Avatar, PageHeader, Pagination, Pill, RoleBadge, VerifiedMark } from "@/components/ui";
import { ROLE_LABELS, type RoleKey } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const where = {
    ...(sp.role && sp.role in ROLE_LABELS ? { role: sp.role as RoleKey } : {}),
    ...(sp.status === "suspended" ? { status: "suspended" as const } : {}),
    ...(sp.q ? { OR: [{ email: { contains: sp.q, mode: "insensitive" as const } }, { profile: { orgName: { contains: sp.q, mode: "insensitive" as const } } }] } : {}),
  };
  const [users, total] = await Promise.all([db.user.findMany({ where, include: { profile: { select: { orgName: true, photoUrl: true, isClaimed: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 }), db.user.count({ where })]);
  return (
    <>
      <PageHeader eyebrow="People" title="Users" subtitle={`${total} accounts`} />
      <form className="mb-5 flex flex-wrap gap-3">
        <input name="q" defaultValue={sp.q} className="input max-w-sm" placeholder="Search email or organisation" aria-label="Search users" />
        <select name="role" defaultValue={sp.role ?? ""} className="input w-auto" aria-label="Role">
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="input w-auto" aria-label="Status">
          <option value="">Any status</option>
          <option value="suspended">Suspended</option>
        </select>
        <button className="rounded-full bg-primary px-5 font-semibold text-white">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[15px]">
          <thead className="border-b border-line bg-cream text-xs text-muted uppercase">
            <tr>
              <th className="px-5 py-3">Organisation</th>
              <th className="px-3 py-3">Role</th>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Joined</th>
              <th className="px-5 py-3">Last sign-in</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-cream">
                <td className="px-5 py-3">
                  <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 font-semibold hover:text-leaf">
                    <Avatar src={u.profile?.photoUrl} name={u.profile?.orgName ?? u.email} size={34} rounded="rounded-lg" />
                    <span className="truncate">{u.profile?.orgName ?? "—"}</span>
                    {u.isVerified && <VerifiedMark label={false} />}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-3 py-3 text-sm">{u.email}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Pill tone={u.status === "active" ? "green" : "red"}>{u.status}</Pill>
                    {u.profile && !u.profile.isClaimed && <Pill tone="gold">unclaimed</Pill>}
                    {u.totpEnabled && <Pill tone="blue">2FA</Pill>}
                  </div>
                </td>
                <td className="px-3 py-3 text-sm whitespace-nowrap">{formatDate(u.createdAt)}</td>
                <td className="px-5 py-3 text-sm whitespace-nowrap">{formatDate(u.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={Math.ceil(total / 50)} hrefFor={(p) => `/admin/users?${new URLSearchParams({ ...(sp.q && { q: sp.q }), ...(sp.role && { role: sp.role }), page: String(p) })}`} />
    </>
  );
}
