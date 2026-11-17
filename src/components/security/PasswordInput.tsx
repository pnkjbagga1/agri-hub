"use client";

import { useState } from "react";
import { Check, X, Eye, EyeOff } from "lucide-react";
import { passwordStrength } from "@/lib/safety";

const BAR = ["bg-danger", "bg-danger", "bg-highlight", "bg-leaf", "bg-leaf"];

/** New-password input with a live strength meter and the rules it must meet. */
export function PasswordInput({ name = "password", emailFieldName = "email" }: { name?: string; emailFieldName?: string }) {
  const [value, setValue] = useState("");
  const [email, setEmail] = useState<string | undefined>();
  const [show, setShow] = useState(false);
  const s = passwordStrength(value, email);
  return (
    <div>
      <div className="relative">
        <input
          name={name}
          type={show ? "text" : "password"}
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
          className="input pr-12"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            // read the email typed elsewhere on the form, so the meter can warn about passwords that contain it
            const root = e.currentTarget.form ?? e.currentTarget.closest("form, section, main") ?? document;
            setEmail((root.querySelector(`input[name="${emailFieldName}"]`) as HTMLInputElement | null)?.value || undefined);
          }}
          aria-describedby={`${name}-strength`}
        />
        <button type="button" onClick={() => setShow((v) => !v)} className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <div id={`${name}-strength`} className="mt-2" aria-live="polite">
        <div className="flex gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${value && i <= Math.max(1, s.score) ? BAR[s.score] : "bg-line"}`} />
          ))}
        </div>
        {value && <p className="mt-1 text-xs font-semibold">Password strength: {s.label}</p>}
        <ul className="mt-1 space-y-0.5 text-xs">
          {s.checks.map((c) => (
            <li key={c.text} className={`flex items-center gap-1 ${c.ok ? "text-leaf" : "text-muted"}`}>
              {c.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />} {c.text}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted">Tip: a short sentence makes a strong password. Never reuse a password from another site.</p>
      </div>
    </div>
  );
}
