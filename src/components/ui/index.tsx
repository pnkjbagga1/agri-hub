import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Star, BadgeCheck } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { asset } from "@/lib/paths";
import { CERTIFICATIONS, ROLE_LABELS, ROLE_TONE, type RoleKey } from "@/lib/constants";

/* ---------------- Buttons ---------------- */
type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "gold" | "light";
type Size = "sm" | "md" | "lg";
const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-leaf",
  secondary: "bg-primary-soft text-primary hover:bg-[#d4e4d8]",
  ghost: "text-ink hover:bg-sand/70",
  outline: "bg-white text-ink ring-1 ring-inset ring-line hover:ring-primary/50 hover:text-primary",
  danger: "bg-danger text-white hover:bg-[#912018]",
  gold: "bg-highlight text-white hover:bg-[#a67825]",
  light: "bg-white text-primary hover:bg-sand",
};
const SIZE: Record<Size, string> = { sm: "h-9 px-4 text-sm", md: "h-11 px-5.5 text-[15px]", lg: "h-13 px-7 text-base" };
export const buttonClass = (variant: Variant = "primary", size: Size = "md", extra?: string) =>
  cn("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-55", VARIANT[variant], SIZE[size], extra);

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...props} className={buttonClass(variant, size, className)} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}

/* ---------------- Badges ---------------- */
export function RoleBadge({ role, className }: { role: string; className?: string }) {
  return <span className={cn("pill", ROLE_TONE[role as RoleKey] ?? ROLE_TONE.grower, className)}>{ROLE_LABELS[role as RoleKey] ?? role}</span>;
}

export function CertBadge({ cert }: { cert: string }) {
  const c = CERTIFICATIONS.find((x) => x.key === cert);
  return <span className={cn("pill", c?.tone ?? "bg-sand text-ink ring-line")}>{c?.label ?? cert}</span>;
}

export function VerifiedMark({ className, label = true }: { className?: string; label?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold text-primary", className)} title="Verified by GRIS Canada">
      <BadgeCheck className="size-4" aria-hidden />
      {label && "Verified"}
    </span>
  );
}

export function Pill({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "green" | "gold" | "red" | "blue" | "dark"; className?: string }) {
  const t = {
    neutral: "bg-sand text-ink-soft ring-line",
    green: "bg-primary-soft text-primary ring-primary/20",
    gold: "bg-highlight-soft text-[#7a5a12] ring-highlight/30",
    red: "bg-danger-soft text-danger ring-danger/20",
    blue: "bg-[#e4eef6] text-[#24557a] ring-[#24557a]/20",
    dark: "bg-ink text-white ring-ink",
  }[tone];
  return <span className={cn("pill", t, className)}>{children}</span>;
}

/* ---------------- Avatar ---------------- */
export function Avatar({ src, name, size = 48, className, rounded = "rounded-2xl" }: { src?: string | null; name: string; size?: number; className?: string; rounded?: string }) {
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset(src)} alt="" width={size} height={size} className={cn("shrink-0 object-cover bg-sand", rounded, className)} style={{ width: size, height: size }} />;
  return (
    <span className={cn("grid shrink-0 place-items-center bg-primary font-display font-bold text-white", rounded, className)} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {initials(name) || "?"}
    </span>
  );
}

/* ---------------- Rating ---------------- */
export function Stars({ value, count, size = 14 }: { value: number | null; count?: number; size?: number }) {
  if (value == null) return <span className="text-xs text-muted">No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(value) ? "fill-highlight text-highlight" : "text-line"} aria-hidden />
      ))}
      <span className="ml-1 font-semibold">{value.toFixed(1)}</span>
      {count != null && <span className="text-muted">({count})</span>}
    </span>
  );
}

/* ---------------- Layout helpers ---------------- */
export function SectionHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="text-2xl text-ink sm:text-3xl">{title}</h2>
        {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-3xl sm:text-[2.6rem] sm:leading-tight">{title}</h1>
        {subtitle && <div className="mt-2 max-w-2xl text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, tone = "green" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "green" | "gold" | "blue" | "ink" }) {
  const t = { green: "bg-primary-soft text-primary", gold: "bg-highlight-soft text-[#8a5a00]", blue: "bg-[#e4eef6] text-[#24557a]", ink: "bg-ink text-white" }[tone];
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon && <span className={cn("grid size-9 place-items-center rounded-xl", t)}>{icon}</span>}
      </div>
      <p className="mt-2 font-display text-3xl font-black text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Progress({ value, max, tone = "primary" }: { value: number; max: number; tone?: "primary" | "gold" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", tone === "gold" ? "bg-highlight" : "bg-primary")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
      {page > 1 && <ButtonLink variant="outline" size="sm" href={hrefFor(page - 1)}>Previous</ButtonLink>}
      <span className="px-3 text-sm text-muted">
        Page {page} of {pages}
      </span>
      {page < pages && <ButtonLink variant="outline" size="sm" href={hrefFor(page + 1)}>Next</ButtonLink>}
    </nav>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode; className?: string }) {
  const t = {
    info: "bg-[#eef4fa] text-[#24557a] ring-[#24557a]/15",
    warn: "bg-highlight-soft text-[#7a5a12] ring-highlight/30",
    error: "bg-danger-soft text-danger ring-danger/20",
    success: "bg-primary-soft text-primary ring-primary/20",
  }[tone];
  return <div className={cn("rounded-xl px-4 py-3 text-sm ring-1 ring-inset", t, className)}>{children}</div>;
}
