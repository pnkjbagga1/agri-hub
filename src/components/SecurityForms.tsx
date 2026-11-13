"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, LogOut, MailCheck, ShieldCheck, Smartphone } from "lucide-react";
import { Button, Notice } from "@/components/ui";
import { Field, FormError } from "@/components/forms";
import { api, ClientApiError } from "@/lib/client";

const msg = (e: unknown) => (e instanceof ClientApiError ? e.message : "Something went wrong.");

export function ChangePassword() {
  const [state, setState] = useState<{ ok?: boolean; error?: string; fields?: Record<string, string> }>({});
  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        if (f.get("password") !== f.get("confirm")) return setState({ fields: { confirm: "Passwords don't match" } });
        try {
          await api("/auth/change-password", { body: { current: f.get("current"), password: f.get("password") } });
          form.reset();
          setState({ ok: true });
        } catch (err) {
          setState({ error: msg(err), fields: err instanceof ClientApiError ? err.fields : {} });
        }
      }}
    >
      <h2 className="flex items-center gap-2 text-lg">
        <KeyRound className="size-5 text-leaf" /> Change password
      </h2>
      {state.ok && <Notice tone="success">Password changed. Other devices have been signed out.</Notice>}
      <FormError message={state.error} />
      <Field label="Current password" error={state.fields?.current}>
        <input name="current" type="password" required autoComplete="current-password" className="input" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" error={state.fields?.password} hint="10+ characters, letters and numbers">
          <input name="password" type="password" required minLength={10} autoComplete="new-password" className="input" />
        </Field>
        <Field label="Confirm new password" error={state.fields?.confirm}>
          <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className="input" />
        </Field>
      </div>
      <Button>Update password</Button>
    </form>
  );
}

export function TwoFactor({ enabled, autoStart }: { enabled: boolean; autoStart?: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);
  const start = async () => {
    setError(null);
    try {
      setSetup(await api<{ secret: string; qrSvg: string }>("/auth/totp-setup", { body: {} }));
    } catch (e) {
      setError(msg(e));
    }
  };
  return (
    <div className="card space-y-4 p-6">
      <h2 className="flex items-center gap-2 text-lg">
        <Smartphone className="size-5 text-leaf" /> Two-factor authentication
      </h2>
      <FormError message={error} />
      {enabled && !disabling && (
        <>
          <Notice tone="success">
            <ShieldCheck className="mr-1 inline size-4" /> Two-factor authentication is ON. You&apos;ll enter a code from your authenticator app at sign-in.
          </Notice>
          <Button variant="ghost" size="sm" onClick={() => setDisabling(true)}>
            Turn off two-factor
          </Button>
        </>
      )}
      {enabled && disabling && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await api("/auth/totp-disable", { body: { code: f.get("code"), password: f.get("password") } });
              router.refresh();
              setDisabling(false);
            } catch (err) {
              setError(msg(err));
            }
          }}
        >
          <Field label="Password">
            <input name="password" type="password" required className="input" autoComplete="current-password" />
          </Field>
          <Field label="Current 6-digit code">
            <input name="code" inputMode="numeric" required maxLength={7} className="input font-mono tracking-widest" autoComplete="one-time-code" />
          </Field>
          <Button variant="danger">Turn off</Button>
        </form>
      )}
      {!enabled && !setup && (
        <>
          <p className="text-sm text-muted">Protect your account with a code from Google Authenticator, Microsoft Authenticator, 1Password or Authy.{autoStart && " Strongly recommended for admin accounts."}</p>
          <Button onClick={start}>Set up two-factor</Button>
        </>
      )}
      {!enabled && setup && (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("/auth/totp-enable", { body: { code: new FormData(e.currentTarget).get("code") } });
              setSetup(null);
              router.refresh();
            } catch (err) {
              setError(msg(err));
            }
          }}
        >
          <p className="text-sm">1. Scan this QR code with your authenticator app:</p>
          <div className="size-48 rounded-xl bg-white p-2 ring-1 ring-line" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} role="img" aria-label="Authenticator QR code" />
          <p className="text-xs text-muted">
            Or enter this key manually: <code className="rounded bg-sand px-1.5 py-0.5 font-mono break-all">{setup.secret}</code>
          </p>
          <Field label="2. Enter the 6-digit code it shows">
            <input name="code" inputMode="numeric" required maxLength={7} autoFocus className="input w-44 text-center font-mono text-lg tracking-[0.3em]" autoComplete="one-time-code" />
          </Field>
          <Button>Turn on two-factor</Button>
        </form>
      )}
    </div>
  );
}

export function SessionsAndEmail({ verified, email }: { verified: boolean; email: string }) {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="card space-y-4 p-6">
      <h2 className="flex items-center gap-2 text-lg">
        <MailCheck className="size-5 text-leaf" /> Email & sessions
      </h2>
      {note && <Notice tone="success">{note}</Notice>}
      <p className="text-sm">
        Email: <strong>{email}</strong> {verified ? <span className="font-semibold text-leaf">· confirmed</span> : <span className="font-semibold text-danger">· not confirmed</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {!verified && (
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await api("/auth/resend-verification", { body: {} });
                setNote("Confirmation email sent.");
              } catch (e) {
                setNote(msg(e));
              }
            }}
          >
            Resend confirmation email
          </Button>
        )}
        <Button
          variant="outline"
          onClick={async () => {
            if (!confirm("Sign out of AGRI HUB on every device, including this one?")) return;
            await api("/auth/logout-all", { body: {} });
            router.push("/login");
            router.refresh();
          }}
        >
          <LogOut className="size-4" /> Sign out everywhere
        </Button>
      </div>
    </div>
  );
}
