import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmail } from "@/components/auth/RecoveryForms";

export const metadata: Metadata = { title: "Confirm your email" };

export default function VerifyPage() {
  return (
    <AuthShell eyebrow="Email confirmation" title="Confirming your email">
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </AuthShell>
  );
}
