import Link from "next/link";
import { ShieldAlert, ShieldCheck, Circle, CheckCircle2 } from "lucide-react";
import { PARTNER_ROLES, type RoleKey } from "@/lib/constants";

type Props = { role: string; emailVerified: boolean; twoFactor: boolean };

/**
 * "Protect your account" prompt shown on dashboards until the basics are done.
 * Admins are told two-step verification is required; partners that it's strongly recommended.
 */
export function SecurityPrompt({ role, emailVerified, twoFactor }: Props) {
  if (emailVerified && twoFactor) return null;
  const admin = role === "admin";
  const partner = PARTNER_ROLES.includes(role as RoleKey);
  const urgent = admin || (!emailVerified && partner);
  const items = [
    { done: emailVerified, label: "Verify your email address", why: "so we can reach you about your account and password resets" },
    { done: twoFactor, label: admin ? "Turn on two-step verification (required for admins)" : "Turn on two-step verification", why: "a code from an authenticator app stops anyone who steals your password" },
  ];
  return (
    <section className={`mb-6 rounded-[18px] p-5 ring-1 ${urgent ? "bg-danger-soft ring-danger/30" : "bg-highlight-soft ring-highlight/40"}`} aria-labelledby="security-prompt-title">
      <div className="flex items-start gap-3">
        {urgent ? <ShieldAlert className="mt-0.5 size-6 shrink-0 text-danger" /> : <ShieldCheck className="mt-0.5 size-6 shrink-0 text-highlight" />}
        <div className="min-w-0 flex-1">
          <h2 id="security-prompt-title" className="text-lg">
            {admin ? "Secure your admin account" : "Protect your account"}
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {admin
              ? "Admin accounts can see member data, so two-step verification is required."
              : partner
                ? "Partner accounts receive leads and member contacts. Two quick steps keep them safe."
                : "Two quick steps keep your listings, messages and buyers safe."}
          </p>
          <ul className="mt-3 space-y-2">
            {items.map((i) => (
              <li key={i.label} className="flex gap-2 text-sm">
                {i.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-leaf" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted" />}
                <span className={i.done ? "text-muted line-through" : ""}>
                  <strong>{i.label}</strong>
                  {!i.done && <span className="text-ink-soft">: {i.why}</span>}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/settings" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-white">
            Go to account security
          </Link>
        </div>
      </div>
    </section>
  );
}
