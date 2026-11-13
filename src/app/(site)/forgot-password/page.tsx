import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotForm } from "@/components/auth/RecoveryForms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <AuthShell eyebrow="Account recovery" title="Forgot your password?" subtitle="Enter your email and we'll send a secure link that expires in 30 minutes.">
      <ForgotForm />
    </AuthShell>
  );
}
