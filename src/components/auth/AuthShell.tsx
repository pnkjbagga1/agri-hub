import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { asset } from "@/lib/paths";

export function AuthShell({ eyebrow, title, subtitle, children, aside, switcher }: { eyebrow: string; title: string; subtitle?: string; children: ReactNode; aside?: ReactNode; switcher?: ReactNode }) {
  return (
    <div className="container-page grid min-h-[calc(100dvh-72px)] items-center gap-10 py-10 lg:grid-cols-2">
      <div className="mx-auto w-full max-w-md">
        <Image src={asset("/brand/GRIS_Logo_Wordmark.png")} alt="GRIS — Green Revolution Innovation Society" width={150} height={70} className="mb-6 h-auto w-[150px]" />
        <p className="eyebrow text-leaf!">{eyebrow}</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
        {switcher && <div className="mt-5">{switcher}</div>}
        <div className="mt-6">{children}</div>
      </div>
      <div className="hidden h-full min-h-[520px] flex-col justify-between rounded-[18px] bg-primary p-10 text-white lg:flex">
        <div>
          <p className="eyebrow">The Agri Hub</p>
          <p className="mt-4 font-display text-4xl leading-tight font-black">
            Bring what you know. <span className="accent text-gold-soft">Take what you need.</span>
          </p>
        </div>
        {aside}
        <p className="text-sm text-white/60">
          GRIS Canada — Green Revolution Innovation Society ·{" "}
          <Link href="/about" className="underline">
            About AGRI HUB
          </Link>
        </p>
      </div>
    </div>
  );
}

export function PortalSwitcher({ active }: { active: "member" | "partner" }) {
  const tab = (key: string, href: string, label: string) => (
    <Link href={href} className={`flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold ${active === key ? "bg-primary text-white" : "text-muted hover:text-ink"}`} aria-current={active === key ? "page" : undefined}>
      {label}
    </Link>
  );
  return (
    <div className="flex rounded-full bg-white p-1 ring-1 ring-line">
      {tab("member", "/login", "Growers & Buyers")}
      {tab("partner", "/partners/login", "Partners & Programs")}
    </div>
  );
}
