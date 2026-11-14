import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/paths";

/** GRIS Canada lockup (badge + wordmark, same as griscanada.org) followed by the "Agri Hub" section label. */
export function BrandMark({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" className={cn("flex shrink-0 items-center gap-3", className)} aria-label="GRIS Canada Agri Hub — home">
      <Image
        src={asset(light ? "/brand/gris-lockup-light.png" : "/brand/gris-lockup.png")}
        alt="GRIS Canada, Green Revolution Innovation Society"
        width={664}
        height={240}
        priority
        className="h-[44px] w-auto sm:h-[50px]"
      />
      <span className={cn("hidden h-9 w-px sm:block", light ? "bg-white/30" : "bg-line")} aria-hidden />
      <span
        className={cn(
          "hidden font-display text-[19px] leading-none font-black tracking-[-0.02em] sm:block",
          light ? "text-white" : "text-primary",
        )}
      >
        Agri <span className="text-highlight">Hub</span>
      </span>
    </Link>
  );
}
