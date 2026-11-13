import { requireAdmin } from "@/server/guards";
import { ChangePassword, SessionsAndEmail, TwoFactor } from "@/components/SecurityForms";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "My security" };

export default async function AdminSecurityPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const user = await requireAdmin();
  const { setup } = await searchParams;
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Account" title="My security" subtitle="Admin sessions expire after 8 hours. Two-factor authentication is strongly recommended." />
      <div className="space-y-6">
        <TwoFactor enabled={user.totpEnabled} autoStart={!!setup} />
        <ChangePassword />
        <SessionsAndEmail verified={!!user.emailVerifiedAt} email={user.email} />
      </div>
    </div>
  );
}
