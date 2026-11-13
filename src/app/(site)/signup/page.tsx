import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupFlow } from "@/components/auth/SignupFlow";

export const metadata: Metadata = { title: "Join AGRI HUB — free" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  if (await getSessionUser()) redirect("/dashboard");
  const { role } = await searchParams;
  const regions = await db.region.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  return (
    <AuthShell
      eyebrow="Create your account"
      title="Join the Agri Hub"
      subtitle="Select the profile type that best describes you. Free for every member — no commission on sales."
      aside={
        <ul className="space-y-3 text-white/85">
          <li>• One account, nine stakeholder types</li>
          <li>• Verified badges for certified growers</li>
          <li>• Direct messaging and structured RFQs</li>
          <li>• Programs from EDC, FCC, BC & federal government</li>
        </ul>
      }
    >
      <SignupFlow regions={regions} initialCard={role} />
    </AuthShell>
  );
}
