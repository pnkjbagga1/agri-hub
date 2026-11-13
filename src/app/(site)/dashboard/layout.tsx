import Link from "next/link";
import { requireOnboarded } from "@/server/guards";
import { DashNav } from "@/components/layout/DashNav";
import { Avatar, Notice, RoleBadge, VerifiedMark } from "@/components/ui";
import { PARTNER_ROLES, type RoleKey } from "@/lib/constants";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOnboarded();
  if (user.role === "admin") redirect("/admin");
  const p = user.profile!;
  const role = user.role as RoleKey;
  const kind = role === "grower" ? "grower" : role === "buyer" ? "buyer" : PARTNER_ROLES.includes(role) ? "partner" : "buyer";
  return (
    <div className="container-page py-8">
      <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="card mb-4 flex items-center gap-3 p-4">
            <Avatar src={p.photoUrl} name={p.orgName} size={48} />
            <div className="min-w-0">
              <p className="truncate font-bold">{p.orgName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <RoleBadge role={role} />
                {user.isVerified && <VerifiedMark label={false} />}
              </div>
            </div>
          </div>
          <DashNav kind={kind} />
        </aside>
        <div className="min-w-0">
          {!user.emailVerifiedAt && (
            <Notice tone="info" className="mb-6">
              Please confirm your email ({user.email}) — check your inbox, or resend from <Link href="/settings" className="font-semibold underline">Settings</Link>.
            </Notice>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
