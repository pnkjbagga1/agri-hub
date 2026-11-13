import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/paths";

export function BrandMark({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" className={cn("flex shrink-0 items-center gap-2.5", className)} aria-label="AGRI HUB home">
      <Image src={asset("/brand/GRIS_Logo_Badge.png")} alt="" width={38} height={39} priority className="h-auto w-[38px]" />
      <span className="leading-none">
        <span className={cn("block font-display text-[20px] font-black tracking-[-0.02em]", light ? "text-white" : "text-primary")}>
          Agri <span className="text-highlight">Hub</span>
        </span>
        <span className={cn("block text-[10px] font-bold tracking-[0.16em] uppercase", light ? "text-white/70" : "text-muted")}>GRIS Canada</span>
      </span>
    </Link>
  );
}
