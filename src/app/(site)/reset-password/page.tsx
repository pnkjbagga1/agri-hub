import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/RecoveryForms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPage() {
  return (
    <AuthShell eyebrow="Account recovery" title="Choose a new password" subtitle="At least 10 characters with letters and numbers. You'll be signed out everywhere else.">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
