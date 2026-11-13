"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, ClipboardCheck, ExternalLink, Flag, Inbox, LogOut, Menu, PackagePlus, ScrollText, Settings, ShieldCheck, Target, Users, X } from "lucide-react";
import { BrandMark } from "@/components/layout/Brand";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

export function AdminNav({ counts, email }: { counts: { approvals: number; reports: number }; email: string }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = [
    { href: "/admin", label: "Overview", icon: BarChart3 },
    { href: "/admin/approvals", label: "Approvals", icon: ClipboardCheck, badge: counts.approvals },
    { href: "/admin/reports", label: "Reports & claims", icon: Flag, badge: counts.reports },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/listings/new", label: "Assisted listing", icon: PackagePlus },
    { href: "/admin/kpis", label: "KPI targets", icon: Target },
    { href: "/admin/settings", label: "Settings", icon: Settings },
    { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    { href: "/admin/mailbox", label: "Mailbox", icon: Inbox },
    { href: "/admin/security", label: "My security", icon: ShieldCheck },
  ];
  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Admin">
      {items.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold", active ? "bg-white text-primary" : "text-white/80 hover:bg-white/10 hover:text-white")} aria-current={active ? "page" : undefined}>
            <i.icon className="size-4.5" /> {i.label}
            {!!i.badge && <span className="ml-auto rounded-full bg-highlight px-2 text-xs font-bold text-white">{i.badge}</span>}
          </Link>
        );
      })}
      <Link href="/" className="mt-4 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-white/70 hover:text-white">
        <ExternalLink className="size-4" /> View public site
      </Link>
      <button
        onClick={async () => {
          await api("/auth/logout", { body: {} });
          router.push("/admin/login");
          router.refresh();
        }}
        className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm text-white/70 hover:text-white"
      >
        <LogOut className="size-4" /> Sign out
      </button>
    </nav>
  );
  return (
    <>
      <div className="flex items-center justify-between bg-primary px-4 py-3 lg:hidden">
        <BrandMark light />
        <button onClick={() => setOpen(!open)} className="grid size-10 place-items-center rounded-xl text-white" aria-label="Admin menu" aria-expanded={open}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && <div className="bg-primary px-4 pb-4 lg:hidden">{nav}</div>}
      <aside className="hidden bg-primary p-5 lg:sticky lg:top-0 lg:block lg:h-dvh lg:overflow-y-auto">
        <BrandMark light />
        <p className="mt-2 mb-6 text-xs font-bold tracking-widest text-highlight uppercase">Admin console</p>
        {nav}
        <p className="mt-6 truncate text-xs text-white/50">{email}</p>
      </aside>
    </>
  );
}
