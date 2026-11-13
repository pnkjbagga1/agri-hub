import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/session";
import { AuthShell, PortalSwitcher } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in — growers & buyers" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/dashboard");
  return (
    <AuthShell eyebrow="Member sign in" title="Welcome back" subtitle="Growers and buyers sign in here to manage listings, RFQs and messages." switcher={<PortalSwitcher active="member" />}>
      <Suspense>
        <LoginForm portal="member" />
      </Suspense>
    </AuthShell>
  );
}
