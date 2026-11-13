import Link from "next/link";
import Image from "next/image";
import { TAGLINE } from "@/lib/constants";
import { asset } from "@/lib/paths";

export function SiteFooter() {
  const cols = [
    { title: "Marketplace", links: [["Browse produce", "/marketplace"], ["Demand board", "/demand"], ["Market insights", "/insights"], ["Map view", "/marketplace?view=map"]] },
    { title: "Ecosystem", links: [["Stakeholder directory", "/directory"], ["Programs & funding", "/resources"], ["Events", "/events"], ["Community", "/community"]] },
    { title: "Join", links: [["Growers", "/signup?role=grower"], ["Buyers", "/signup?role=buyer"], ["Partners & programs", "/signup?role=finance"], ["Partner sign in", "/partners/login"]] },
    { title: "About", links: [["About AGRI HUB", "/about"], ["GRIS Canada", "https://griscanada.org/"], ["Privacy", "/about#privacy"], ["Terms", "/about#terms"]] },
  ];
  return (
    <footer className="mt-24 bg-ink text-white/80">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <div className="inline-block rounded-2xl bg-white p-3">
            <Image src={asset("/brand/GRIS_Logo_Wordmark.png")} alt="GRIS — Green Revolution Innovation Society" width={160} height={74} className="h-auto w-40" />
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed">AGRI HUB is GRIS Canada&apos;s sector-development and connection platform for BC&apos;s agri-food ecosystem — starting in Abbotsford, built to grow across Canada and beyond.</p>
          <p className="mt-3 text-xs tracking-wide text-highlight">{TAGLINE}</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="mb-3 text-sm font-bold text-white">{c.title}</p>
            <ul className="space-y-2 text-sm">
              {c.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href!} className="hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-white/55">
          <p>© {new Date().getFullYear()} GRIS Canada — Green Revolution Innovation Society, a BC non-profit society. Abbotsford, British Columbia.</p>
          <p>AGRI HUB does not take a commission on transactions between members.</p>
        </div>
      </div>
    </footer>
  );
}
