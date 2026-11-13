import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/session";
import { AuthShell, PortalSwitcher } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Partner sign in — programs, research & services" };

export default async function PartnerLoginPage() {
  if (await getSessionUser()) redirect("/dashboard");
  return (
    <AuthShell
      eyebrow="Stakeholder partner portal"
      title="Partner sign in"
      subtitle="Universities, consultants, EDC / FCC and financing partners, government programs, ag-tech, suppliers, dealers and marketing partners."
      switcher={<PortalSwitcher active="partner" />}
      aside={
        <ul className="space-y-3 text-white/85">
          <li>• Post grants, financing offers, courses and demos</li>
          <li>• Receive expressions of interest from growers</li>
          <li>• Host events and appear in the stakeholder directory</li>
        </ul>
      }
    >
      <Suspense>
        <LoginForm portal="partner" />
      </Suspense>
    </AuthShell>
  );
}
