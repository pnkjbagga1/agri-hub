"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Field({ label, error, hint, children, className, required }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <div className={className}>
      <label className="label">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? <p className="mt-1 text-sm font-medium text-danger" role="alert">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger ring-1 ring-danger/20 ring-inset">
      {message}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input,textarea,select,button")?.focus();
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/45" onClick={onClose} />
      <div ref={ref} className={cn("relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-cream p-6 shadow-2xl sm:rounded-[22px]", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl">{title}</h2>
          <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-sand" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Read a <form> into a plain object; repeated names become arrays. */
export function formToObject(form: HTMLFormElement, arrays: string[] = []) {
  const fd = new FormData(form);
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    const vals = fd.getAll(key).map((v) => (typeof v === "string" ? v : ""));
    out[key] = arrays.includes(key) ? vals.filter(Boolean) : (vals[0] ?? "");
  }
  for (const a of arrays) out[a] ??= [];
  return out;
}
