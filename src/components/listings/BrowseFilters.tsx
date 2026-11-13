"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { BellPlus, Map, LayoutGrid, Search, SlidersHorizontal, X } from "lucide-react";
import { CATEGORIES, CERTIFICATIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { api, ClientApiError } from "@/lib/client";

type Region = { slug: string; name: string };

function useParamsState() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const update = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString());
    mut(p);
    p.delete("page");
    start(() => router.push(`${path}?${p.toString()}`, { scroll: false }));
  };
  return { sp, update, pending };
}

export function FilterPanel({ regions }: { regions: Region[] }) {
  const { sp, update, pending } = useParamsState();
  const [open, setOpen] = useState(false);
  const toggle = (key: string, value: string) =>
    update((p) => {
      const cur = p.getAll(key);
      p.delete(key);
      (cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]).forEach((v) => p.append(key, v));
    });
  const groups: { key: string; title: string; options: { value: string; label: string }[] }[] = [
    { key: "category", title: "Category", options: CATEGORIES.map((c) => ({ value: c.key, label: c.label })) },
    { key: "region", title: "Region", options: regions.map((r) => ({ value: r.slug, label: r.name })) },
    { key: "cert", title: "Certification", options: CERTIFICATIONS.map((c) => ({ value: c.key, label: c.label })) },
  ];
  const active = ["category", "region", "cert", "season"].reduce((n, k) => n + sp.getAll(k).length, 0);
  const panel = (
    <div className={cn("space-y-6 transition", pending && "opacity-60")}>
      <div>
        <p className="mb-2 text-sm font-bold">Availability</p>
        <div className="flex flex-wrap gap-2">
          {[
            ["", "Any time"],
            ["now", "In season now"],
            ["upcoming", "Pre-order"],
          ].map(([v, l]) => (
            <button key={v} type="button" onClick={() => update((p) => (v ? p.set("season", v) : p.delete("season")))} className={cn("rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset", (sp.get("season") ?? "") === v ? "bg-primary text-white ring-primary" : "bg-white ring-line hover:ring-primary/40")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {groups.map((g) => (
        <fieldset key={g.key}>
          <legend className="mb-2 text-sm font-bold">{g.title}</legend>
          <div className="space-y-1.5">
            {g.options.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-0.5 text-[15px] hover:bg-sand/60">
                <input type="checkbox" className="size-4 accent-[#0c3520]" checked={sp.getAll(g.key).includes(o.value)} onChange={() => toggle(g.key, o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {active > 0 && (
        <button type="button" onClick={() => update((p) => ["category", "region", "cert", "season"].forEach((k) => p.delete(k)))} className="text-sm font-semibold text-danger hover:underline">
          Clear all filters
        </button>
      )}
    </div>
  );
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold ring-1 ring-line lg:hidden">
        <SlidersHorizontal className="size-4" /> Filters {active > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-white">{active}</span>}
      </button>
      <aside className="card sticky top-24 hidden self-start p-5 lg:block">
        <p className="mb-4 font-display text-lg font-black">Filters</p>
        {panel}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-cream p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-lg font-black">Filters</p>
              <button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full hover:bg-sand" aria-label="Close filters">
                <X className="size-5" />
              </button>
            </div>
            {panel}
            <button onClick={() => setOpen(false)} className="mt-6 h-12 w-full rounded-full bg-primary font-semibold text-white">
              Show results
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function SearchSortBar({ total, signedIn }: { total: number; signedIn: boolean }) {
  const { sp, update } = useParamsState();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  const view = sp.get("view") ?? "grid";
  async function saveSearch() {
    const name = sp.get("q") || [...sp.getAll("category"), ...sp.getAll("region")].join(", ") || "All listings";
    try {
      await api("/saved-searches", { body: { name, query: { q: sp.get("q") ?? undefined, category: sp.getAll("category"), region: sp.getAll("region"), cert: sp.getAll("cert") }, alert: true } });
      setSaved("Saved — we'll notify you about new matches.");
    } catch (e) {
      setSaved(e instanceof ClientApiError ? e.message : "Could not save");
    }
  }
  return (
    <div className="mb-5 space-y-3">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          update((p) => (q.trim() ? p.set("q", q.trim()) : p.delete("q")));
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input h-12 rounded-full! pr-28 pl-12 text-base" placeholder="Search produce, variety or grower — e.g. organic blueberries" aria-label="Search listings" />
        <button className="absolute top-1.5 right-1.5 h-9 rounded-full bg-primary px-5 text-sm font-semibold text-white hover:bg-leaf">Search</button>
      </form>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted">
          <strong className="text-ink">{total}</strong> listing{total === 1 ? "" : "s"}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {signedIn && (
            <button type="button" onClick={saveSearch} className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold ring-1 ring-line hover:ring-primary/40" title="Get notified about new matching listings">
              <BellPlus className="size-4" /> Save search
            </button>
          )}
          <div className="flex rounded-full bg-white p-1 ring-1 ring-line">
            {[
              ["grid", LayoutGrid, "Grid"],
              ["map", Map, "Map"],
            ].map(([v, Icon, label]) => {
              const I = Icon as typeof Map;
              return (
                <button key={v as string} type="button" onClick={() => update((p) => (v === "grid" ? p.delete("view") : p.set("view", v as string)))} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold", view === v ? "bg-primary text-white" : "text-muted")} aria-pressed={view === v}>
                  <I className="size-4" /> {label as string}
                </button>
              );
            })}
          </div>
          <label className="sr-only" htmlFor="sort">
            Sort
          </label>
          <select id="sort" value={sp.get("sort") ?? "newest"} onChange={(e) => update((p) => (e.target.value === "newest" ? p.delete("sort") : p.set("sort", e.target.value)))} className="input h-10 w-auto rounded-full! py-0 text-sm">
            <option value="newest">Newest first</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="distance">Distance</option>
            <option value="harvest">Harvest date</option>
          </select>
        </div>
      </div>
      {saved && <p className="text-sm font-medium text-leaf">{saved}</p>}
    </div>
  );
}
