import type { Metadata } from "next";
import credits from "../../../../public/seed/photos/credits.json";
import { PageHeader } from "@/components/ui";
import { asset } from "@/lib/paths";

export const metadata: Metadata = { title: "Photo credits", description: "Attribution for the photographs used on AGRI HUB." };

type Credit = { file: string; author: string; license: string; source: string };

export default function CreditsPage() {
  const rows = (credits as Credit[]).toSorted((a, b) => a.file.localeCompare(b.file));
  return (
    <div className="container-page max-w-4xl py-10">
      <PageHeader eyebrow="About" title="Photo credits" subtitle="Sample photographs on AGRI HUB come from Wikimedia Commons under free licences. Growers' own photos replace them as members upload listings and profiles." />
      <ul className="card divide-y divide-line">
        {rows.map((c) => (
          <li key={c.file} className="flex items-center gap-4 px-5 py-3 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(`/seed/photos/${c.file}`)} alt="" loading="lazy" className="size-14 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold break-words">{c.author}</p>
              <p className="text-xs text-muted">
                {c.license} ·{" "}
                <a href={c.source} target="_blank" rel="noopener noreferrer" className="text-leaf underline">
                  source
                </a>{" "}
                · {c.file}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
