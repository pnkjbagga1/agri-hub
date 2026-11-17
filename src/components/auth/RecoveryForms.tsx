"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { Field, FormError } from "@/components/forms";
import { api, ClientApiError } from "@/lib/client";
import { PasswordInput } from "@/components/security/PasswordInput";

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (sent) return <Notice tone="success">If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder).</Notice>;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api("/auth/forgot", { body: { email: new FormData(e.currentTarget).get("email") } });
          setSent(true);
        } catch (err) {
          setError(err instanceof ClientApiError ? err.message : "Something went wrong");
        }
      }}
    >
      <FormError message={error} />
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" className="input" />
      </Field>
      <Button className="w-full" size="lg">
        Send reset link
      </Button>
    </form>
  );
}

export function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | undefined>();
  if (!token) return <Notice tone="error">This link is missing its token. Request a new reset email.</Notice>;
  if (done)
    return (
      <Notice tone="success">
        Password updated.{" "}
        <Link href={done} className="font-semibold underline">
          Sign in now
        </Link>
      </Notice>
    );
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (f.get("password") !== f.get("confirm")) return setField("Passwords don't match");
        try {
          const r = await api<{ portalHref: string }>("/auth/reset", { body: { token, password: f.get("password") } });
          setDone(r.portalHref);
        } catch (err) {
          if (err instanceof ClientApiError) {
            setError(err.message);
            setField(err.fields.password);
          }
        }
      }}
    >
      <FormError message={error} />
      <Field label="New password" error={field}>
        <PasswordInput />
      </Field>
      <Field label="Confirm password">
        <input name="confirm" type="password" minLength={10} required autoComplete="new-password" className="input" />
      </Field>
      <Button className="w-full" size="lg">
        Update password
      </Button>
    </form>
  );
}

export function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [msg, setMsg] = useState("");
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    api("/auth/verify-email", { body: { token } })
      .then(() => setState("ok"))
      .catch((e) => {
        setState("error");
        setMsg(e instanceof ClientApiError ? e.message : "Verification failed");
      });
  }, [token]);
  if (state === "working") return <p className="text-muted">Checking your link…</p>;
  if (state === "error") return <Notice tone="error">{msg}</Notice>;
  return (
    <Notice tone="success">
      Email confirmed — thank you!{" "}
      <Link href="/dashboard" className="font-semibold underline">
        Go to your dashboard
      </Link>
    </Notice>
  );
}
