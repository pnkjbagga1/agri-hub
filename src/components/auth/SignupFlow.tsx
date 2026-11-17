"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BriefcaseBusiness, Building2, Cpu, GraduationCap, Landmark, Megaphone, ShoppingBasket, Sprout, Tractor, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { BriefcaseBusiness, Building2, Cpu, GraduationCap, Landmark, Megaphone, ShoppingBasket, Sprout, Tractor };
import { Button } from "@/components/ui";
import { Field, FormError } from "@/components/forms";
import { api, ClientApiError } from "@/lib/client";
import { BUYER_TYPES, ROLE_CARDS, ROLE_LABELS, type RoleKey } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { PasswordInput } from "@/components/security/PasswordInput";

type Region = { id: string; name: string };

export function SignupFlow({ regions, initialCard }: { regions: Region[]; initialCard?: string }) {
  const router = useRouter();
  const [card, setCard] = useState<string | null>(ROLE_CARDS.some((c) => c.key === initialCard) ? initialCard! : null);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const chosen = ROLE_CARDS.find((c) => c.key === card);

  if (step === 1)
    return (
      <div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Choose your profile type">
          {ROLE_CARDS.map((c) => {
            const Icon = ICONS[c.icon] ?? Sprout;
            const on = card === c.key;
            return (
              <button key={c.key} type="button" role="radio" aria-checked={on} onClick={() => setCard(c.key)} className={cn("card flex flex-col items-center gap-2 p-4 text-center transition", on ? "border-primary ring-2 ring-primary" : "hover:border-primary/40")}>
                <span className={cn("grid size-12 place-items-center rounded-full", on ? "bg-primary text-white" : "bg-sand text-primary")}>
                  <Icon className="size-6" />
                </span>
                <span className="text-sm leading-tight font-bold">{c.label}</span>
              </button>
            );
          })}
        </div>
        {chosen && <p className="mt-4 rounded-xl bg-white p-4 text-sm text-muted ring-1 ring-line">{chosen.blurb}</p>}
        <Button size="lg" className="mt-6 w-full" disabled={!card} onClick={() => setStep(2)}>
          Continue
        </Button>
        <p className="mt-4 text-center text-sm text-muted">
          Already a member?{" "}
          <Link href="/login" className="font-semibold text-leaf">
            Sign in
          </Link>
        </p>
      </div>
    );

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (f.get("password") !== f.get("confirm")) return setFields({ confirm: "Passwords don't match" });
        setBusy(true);
        setError(null);
        setFields({});
        try {
          await api("/auth/signup", {
            body: {
              role: f.get("role") ?? chosen!.roles[0],
              orgName: f.get("orgName"),
              contactName: f.get("contactName"),
              email: f.get("email"),
              phone: f.get("phone"),
              city: f.get("city"),
              regionId: f.get("regionId") || null,
              buyerType: f.get("buyerType") || null,
              password: f.get("password"),
              acceptTerms: f.get("acceptTerms") === "on",
            },
          });
          router.push("/onboarding");
          router.refresh();
        } catch (err) {
          if (err instanceof ClientApiError) {
            setError(err.message);
            setFields(err.fields);
          } else setError("Could not create your account.");
          setBusy(false);
        }
      }}
    >
      <button type="button" onClick={() => setStep(1)} className="text-sm font-semibold text-leaf hover:underline">
        ← {chosen?.label}
      </button>
      <FormError message={error} />
      {chosen!.roles.length > 1 && (
        <Field label="Organisation type" required>
          <select name="role" className="input" required>
            {chosen!.roles.map((r: RoleKey) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={card === "grower" ? "Farm name" : "Organisation name"} required error={fields.orgName}>
        <input name="orgName" required maxLength={120} className="input" autoComplete="organization" />
      </Field>
      {card === "buyer" && (
        <Field label="Buyer type" required>
          <select name="buyerType" className="input" required>
            {BUYER_TYPES.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required error={fields.contactName}>
          <input name="contactName" required maxLength={80} className="input" autoComplete="name" />
        </Field>
        <Field label="Phone" error={fields.phone}>
          <input name="phone" type="tel" maxLength={30} className="input" autoComplete="tel" />
        </Field>
      </div>
      <Field label="Email" required error={fields.email}>
        <input name="email" type="email" required className="input" autoComplete="email" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City / town" error={fields.city}>
          <input name="city" maxLength={80} className="input" placeholder="Abbotsford" autoComplete="address-level2" />
        </Field>
        <Field label="Region">
          <select name="regionId" className="input" defaultValue={regions[0]?.id}>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
            <option value="">Other / outside BC</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" required error={fields.password} hint="10+ characters, letters and numbers">
          <PasswordInput />
        </Field>
        <Field label="Confirm password" required error={fields.confirm}>
          <input name="confirm" type="password" required minLength={10} className="input" autoComplete="new-password" />
        </Field>
      </div>
      <label className="flex items-start gap-2.5 text-sm text-muted">
        <input type="checkbox" name="acceptTerms" required className="mt-0.5 size-4 accent-[#0c3520]" />
        <span>
          I agree to the AGRI HUB{" "}
          <Link href="/about#terms" className="font-semibold text-leaf" target="_blank">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/about#privacy" className="font-semibold text-leaf" target="_blank">
            privacy notice
          </Link>
          .
        </span>
      </label>
      {fields.acceptTerms && <p className="text-sm text-danger">{fields.acceptTerms}</p>}
      <Button size="lg" className="w-full" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-xs text-muted">Next: add your photo or logo — every profile on AGRI HUB has one.</p>
    </form>
  );
}
