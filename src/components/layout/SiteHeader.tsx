import Link from "next/link";
import { Bell, MessageSquare } from "lucide-react";
import { getSessionUser } from "@/server/session";
import { unreadCounts } from "@/server/queries";
import { ButtonLink } from "@/components/ui";
import { BrandMark } from "./Brand";
import { MobileNav, UserMenu, NavLinks } from "./HeaderClient";

export const NAV = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/demand", label: "Demand Board" },
  { href: "/directory", label: "Directory" },
  { href: "/resources", label: "Programs" },
  { href: "/events", label: "Events" },
  { href: "/community", label: "Community" },
];

export async function SiteHeader() {
  const user = await getSessionUser();
  const unread = user ? await unreadCounts(user.id) : null;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/80">
      <div className="container-page flex h-[72px] items-center gap-4">
        <MobileNav nav={NAV} signedIn={!!user} isAdmin={user?.role === "admin"} />
        <BrandMark />
        <NavLinks nav={NAV} />
        <div className="ml-auto flex items-center gap-1.5">
          {user ? (
            <>
              <Link href="/messages" className="relative grid size-10 place-items-center rounded-xl text-ink-soft hover:bg-sand" aria-label={`Messages${unread?.messages ? `, ${unread.messages} unread` : ""}`}>
                <MessageSquare className="size-5" />
                {!!unread?.messages && <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-highlight px-1 text-[10px] font-bold text-ink">{unread.messages}</span>}
              </Link>
              <Link href="/notifications" className="relative grid size-10 place-items-center rounded-xl text-ink-soft hover:bg-sand" aria-label={`Notifications${unread?.notifications ? `, ${unread.notifications} unread` : ""}`}>
                <Bell className="size-5" />
                {!!unread?.notifications && <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread.notifications}</span>}
              </Link>
              <UserMenu name={user.profile?.orgName ?? user.email} photo={user.profile?.photoUrl ?? null} role={user.role} slug={user.profile?.slug ?? null} />
            </>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup" size="sm" variant="gold">
                Join Us
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
