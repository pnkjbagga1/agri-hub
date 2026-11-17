import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/paths";

/** GRIS logo followed by the "Agri Hub" section label: the GRIS wordmark in the site header, the badge lockup on dark (admin) backgrounds. */
export function BrandMark({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" className={cn("flex shrink-0 items-center gap-3", className)} aria-label="GRIS Canada Agri Hub — home">
      {light ? (
        <Image src={asset("/brand/gris-lockup-light.png")} alt="GRIS Canada, Green Revolution Innovation Society" width={664} height={240} priority className="h-[44px] w-auto sm:h-[50px]" />
      ) : (
        // Site header: the bold GRIS wordmark reads clearly at header size
        <Image src={asset("/brand/GRIS_Logo_Wordmark.png")} alt="GRIS, Green Revolution Innovation Society" width={413} height={192} priority className="h-[46px] w-auto sm:h-[54px]" />
      )}
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
