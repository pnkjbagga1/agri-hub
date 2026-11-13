"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, Menu, Settings, Shield, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, RoleBadge } from "@/components/ui";
import { api } from "@/lib/client";

type NavItem = { href: string; label: string };

export function NavLinks({ nav }: { nav: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="ml-4 hidden items-center gap-0.5 xl:flex" aria-label="Main">
      {nav.map((n) => {
        const active = path === n.href || path.startsWith(n.href + "/");
        return (
          <Link key={n.href} href={n.href} className={cn("rounded-full px-3.5 py-2 text-[15px] font-semibold whitespace-nowrap transition", active ? "bg-primary text-white" : "text-ink hover:bg-sand")} aria-current={active ? "page" : undefined}>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

async function signOut(router: ReturnType<typeof useRouter>) {
  await api("/auth/logout", { body: {} }).catch(() => {});
  router.push("/");
  router.refresh();
}

export function MobileNav({ nav, signedIn, isAdmin }: { nav: NavItem[]; signedIn: boolean; isAdmin: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path; // closes itself when the route changes
  const setOpen = (v: boolean) => setOpenAt(v ? path : null);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);
  return (
    <>
      <button className="grid size-10 place-items-center rounded-xl hover:bg-sand xl:hidden" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[84%] max-w-sm flex-col bg-cream p-5 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-xl font-bold">
                AGRI <span className="text-primary">HUB</span>
              </span>
              <button className="grid size-10 place-items-center rounded-xl hover:bg-sand" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className={cn("rounded-xl px-4 py-3 text-base font-semibold", path.startsWith(n.href) ? "bg-primary-soft text-primary" : "hover:bg-sand")}>
                  {n.label}
                </Link>
              ))}
              <Link href="/insights" className="rounded-xl px-4 py-3 text-base font-semibold hover:bg-sand">
                Market Insights
              </Link>
            </nav>
            <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
              {signedIn ? (
                <>
                  <Link href={isAdmin ? "/admin" : "/dashboard"} className="rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white">
                    {isAdmin ? "Admin console" : "My dashboard"}
                  </Link>
                  <button onClick={() => signOut(router)} className="rounded-xl px-4 py-3 font-semibold text-ink-soft hover:bg-sand">
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/signup" className="rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white">
                    Join AGRI HUB — free
                  </Link>
                  <Link href="/login" className="rounded-xl px-4 py-3 text-center font-semibold ring-1 ring-line">
                    Member sign in
                  </Link>
                  <Link href="/partners/login" className="px-4 py-2 text-center text-sm text-muted">
                    Partner sign in
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function UserMenu({ name, photo, role, slug }: { name: string; photo: string | null; role: string; slug: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const path = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpenAt(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);
  const item = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sand";
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpenAt(open ? null : path)} className="flex items-center gap-1.5 rounded-xl p-1 pr-2 hover:bg-sand" aria-haspopup="menu" aria-expanded={open}>
        <Avatar src={photo} name={name} size={34} rounded="rounded-xl" />
        <ChevronDown className="hidden size-4 text-muted sm:block" />
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 mt-2 w-64 p-2">
          <div className="border-b border-line px-3 pt-1 pb-3">
            <p className="truncate font-semibold">{name}</p>
            <RoleBadge role={role} className="mt-1" />
          </div>
          <div className="pt-2">
            {role === "admin" ? (
              <Link role="menuitem" href="/admin" className={item}>
                <Shield className="size-4" /> Admin console
              </Link>
            ) : (
              <>
                <Link role="menuitem" href="/dashboard" className={item}>
                  <LayoutDashboard className="size-4" /> Dashboard
                </Link>
                {slug && (
                  <Link role="menuitem" href={`/directory/${slug}`} className={item}>
                    <User className="size-4" /> Public profile
                  </Link>
                )}
              </>
            )}
            <Link role="menuitem" href={role === "admin" ? "/admin/security" : "/settings"} className={item}>
              <Settings className="size-4" /> Account & security
            </Link>
            <button role="menuitem" onClick={() => signOut(router)} className={cn(item, "w-full text-danger")}>
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
