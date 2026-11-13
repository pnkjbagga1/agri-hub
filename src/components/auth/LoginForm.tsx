"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, KeyRound, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui";
import { Field, FormError } from "@/components/forms";
import { api, ClientApiError } from "@/lib/client";

type Portal = "member" | "partner" | "admin";

export function LoginForm({ portal }: { portal: Portal }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [redirectHint, setRedirectHint] = useState<string | null>(null);
  const [needTotp, setNeedTotp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    setRedirectHint(null);
    try {
      const r = await api<{ needTotp?: boolean; next?: string; totpRecommended?: boolean }>("/auth/login", {
        body: { email: f.get("email"), password: f.get("password"), portal, totp: f.get("totp") || undefined },
      });
      if (r.needTotp) {
        setNeedTotp(true);
        setBusy(false);
        return;
      }
      const next = sp.get("next");
      // same-origin paths only (blocks //evil, /\evil, javascript:, control chars)
      let safeNext: string | null = null;
      if (next && /^\/[^\\/]/.test(next) && !/[\u0000-\u001f]/.test(next)) {
        try {
          const u = new URL(next, location.origin);
          if (u.origin === location.origin) safeNext = u.pathname + u.search + u.hash;
        } catch {}
      }
      router.push(r.totpRecommended ? "/admin/security?setup=1" : (safeNext ?? r.next ?? "/dashboard"));
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError) {
        setError(err.message);
        if (typeof err.details?.href === "string") setRedirectHint(err.details.href);
      } else setError("Could not sign in. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
      <FormError message={error} />
      {redirectHint && (
        <Link href={redirectHint} className="block text-sm font-semibold text-leaf hover:underline">
          Go to the right sign-in page →
        </Link>
      )}
      <Field label="Email">
        <input name="email" type="email" autoComplete="username" required className="input" />
      </Field>
      <Field label="Password">
        <div className="relative">
          <input name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="input pr-11" />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-sand" aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      {needTotp && (
        <Field label="Authentication code" hint="Enter the 6-digit code from your authenticator app.">
          <input name="totp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus className="input text-center font-mono text-lg tracking-[0.4em]" />
        </Field>
      )}
      <Button className="w-full" size="lg" disabled={busy}>
        {portal === "admin" ? <LockKeyhole className="size-4" /> : <KeyRound className="size-4" />}
        {busy ? "Signing in…" : needTotp ? "Verify & sign in" : "Sign in"}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="font-semibold text-leaf hover:underline">
          Forgot password?
        </Link>
        {portal !== "admin" && (
          <Link href="/signup" className="text-muted hover:text-ink">
            New here? <span className="font-semibold text-leaf">Join free</span>
          </Link>
        )}
      </div>
    </form>
  );
}
