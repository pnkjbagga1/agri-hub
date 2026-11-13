"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, FileText, Heart, LayoutDashboard, Megaphone, PackagePlus, Settings, Sprout, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAVS = {
  grower: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/listings", label: "My listings", icon: Sprout },
    { href: "/dashboard/listings/new", label: "Add listing", icon: PackagePlus },
    { href: "/dashboard/rfqs", label: "RFQs & quotes", icon: FileText },
    { href: "/dashboard/saved", label: "Saved & alerts", icon: Heart },
    { href: "/dashboard/profile", label: "Profile & certificates", icon: UserRound },
  ],
  buyer: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/rfqs", label: "My RFQs", icon: FileText },
    { href: "/dashboard/demand", label: "Demand posts", icon: Megaphone },
    { href: "/dashboard/saved", label: "Saved & alerts", icon: Heart },
    { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  ],
  partner: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/resources", label: "Programs & offers", icon: ClipboardList },
    { href: "/dashboard/leads", label: "Leads", icon: Users },
    { href: "/dashboard/events", label: "Events", icon: CalendarDays },
    { href: "/dashboard/saved", label: "Saved & alerts", icon: Heart },
    { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  ],
};

export function DashNav({ kind }: { kind: keyof typeof NAVS }) {
  const path = usePathname();
  const items = [...NAVS[kind], { href: "/settings", label: "Account & security", icon: Settings }];
  return (
    <nav aria-label="Dashboard" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
      {items.map((i) => {
        const active = i.href === "/dashboard" ? path === "/dashboard" : path === i.href || (path.startsWith(i.href + "/") && !items.some((o) => o.href !== i.href && o.href.startsWith(i.href) && path.startsWith(o.href)));
        return (
          <Link key={i.href} href={i.href} className={cn("flex shrink-0 items-center gap-2.5 rounded-full px-4 py-2.5 text-[15px] font-semibold whitespace-nowrap transition lg:rounded-xl", active ? "bg-primary text-white" : "text-ink-soft hover:bg-sand")} aria-current={active ? "page" : undefined}>
            <i.icon className="size-4.5" /> {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
