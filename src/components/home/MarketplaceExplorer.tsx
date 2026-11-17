"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Sprout, ShoppingBasket, GraduationCap, BriefcaseBusiness, Landmark, Building2, Cpu, Megaphone, Tractor, Play, Pause, RotateCcw, Trophy, Check, ArrowRight, type LucideIcon } from "lucide-react";

type Key = "grower" | "buyer" | "university" | "consultant" | "finance" | "government" | "agtech" | "sales_marketing" | "supplier";

type Node = { key: Key; one: string; label: string; icon: LucideIcon; does: string[]; connects: Key[]; page: { href: string; label: string } };

/* The nine stakeholder doors, matching the sign-up role cards. */
const NODES: Node[] = [
  { key: "grower", one: "a grower", label: "Growers", icon: Sprout, does: ["List produce with photos, volume, price and harvest window", "Answer buyer inquiries and quote RFQs in one chat", "Find grants, loans, trials and expert help"], connects: ["buyer", "finance", "government", "supplier", "agtech", "consultant", "sales_marketing", "university"], page: { href: "/marketplace", label: "Browse the marketplace" } },
  { key: "buyer", one: "a buyer", label: "Buyers", icon: ShoppingBasket, does: ["Search local supply and 10,000+ Buy BC products", "Send RFQs or post what you need on the demand board", "Rate growers and trace every lot by QR code"], connects: ["grower", "supplier", "government", "sales_marketing", "consultant"], page: { href: "/demand", label: "See the demand board" } },
  { key: "university", one: "a university", label: "Universities", icon: GraduationCap, does: ["Share research, courses and webinars", "Host field days and applied-research projects", "Recruit farms and ag-tech partners for trials"], connects: ["grower", "agtech", "government"], page: { href: "/events", label: "See events" } },
  { key: "consultant", one: "a consultant", label: "Consultants", icon: BriefcaseBusiness, does: ["List services and specialties", "Help with CanadaGAP, business plans and grant applications", "Receive consultation requests as leads"], connects: ["grower", "buyer", "finance"], page: { href: "/directory", label: "Find experts" } },
  { key: "finance", one: "a lender", label: "EDC · FCC · Lenders", icon: Landmark, does: ["Post loan, lease and export-financing programs", "Receive referrals from growers who need capital", "Reach export-ready buyers and processors"], connects: ["grower", "buyer", "agtech"], page: { href: "/resources", label: "Funding programs" } },
  { key: "government", one: "a government program", label: "BC & Federal Gov", icon: Building2, does: ["Post grants, Buy BC links and funding calls", "See live supply and demand insights", "Back pilots that cut BC import dependence"], connects: ["grower", "buyer", "university", "agtech"], page: { href: "/insights", label: "Market insights" } },
  { key: "agtech", one: "an ag-tech company", label: "Ag-Tech", icon: Cpu, does: ["Showcase products and book demos", "Run on-farm trials with real growers", "Get feedback and find investors"], connects: ["grower", "university", "finance", "government"], page: { href: "/resources", label: "Trials & offers" } },
  { key: "sales_marketing", one: "a marketing partner", label: "Sales & Marketing", icon: Megaphone, does: ["Offer branding, packaging and go-to-market services", "Help growers win retail and food-service buyers", "Promote Buy BC products"], connects: ["grower", "buyer"], page: { href: "/directory", label: "Find partners" } },
  { key: "supplier", one: "a supplier", label: "Suppliers & Dealers", icon: Tractor, does: ["Offer seed, inputs, packaging and machinery", "Respond to buyer demand with supply offers", "Leasing and service for farm equipment"], connects: ["grower", "buyer", "finance"], page: { href: "/directory", label: "Find suppliers" } },
];

/** A sample deal, played step by step across the map. */
const DEAL: { from: Key; to: Key; title: string; body: string; flow: "produce" | "money" | "know" }[] = [
  { from: "grower", to: "buyer", title: "List", body: "A Fraser Valley grower lists 2,000 kg of highbush blueberries with photos and a July harvest window.", flow: "produce" },
  { from: "buyer", to: "grower", title: "Request a quote", body: "A grocery buyer finds the listing and sends an RFQ: 300 kg a week, delivered to Vancouver.", flow: "money" },
  { from: "consultant", to: "grower", title: "Get help", body: "A consultant helps the grower get CanadaGAP paperwork ready for the retail buyer.", flow: "know" },
  { from: "finance", to: "grower", title: "Fund it", body: "A lender offers a harvest-season loan so the grower can add pickers and cold storage.", flow: "money" },
  { from: "supplier", to: "grower", title: "Supply it", body: "A packaging supplier answers with clamshells and pallets for the order.", flow: "produce" },
  { from: "grower", to: "buyer", title: "Close the deal", body: "The grower quotes, the buyer accepts, rates the farm, and every lot is traceable by QR code. No commission taken.", flow: "produce" },
];

/** Shorter labels for narrow phones, so long names don't collide on the map. */
const SHORT: Partial<Record<Key, string>> = { sales_marketing: "Marketing", supplier: "Suppliers", finance: "Lenders", government: "Government" };

const FLOW_COLOR = { produce: "#2e9e4f", money: "#bc8a2e", know: "#24557a" } as const;
const QUEST_KEY = "agrihub.explorer.v1";

// Node centres on a 100×100 square (percent), evenly spaced on a circle starting at the top.
const R = 39;
const POS: Record<Key, { x: number; y: number }> = Object.fromEntries(
  NODES.map((n, i) => {
    const a = (i / NODES.length) * Math.PI * 2 - Math.PI / 2;
    return [n.key, { x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a) }];
  }),
) as Record<Key, { x: number; y: number }>;

export function MarketplaceExplorer({ counts }: { counts: Partial<Record<Key, number>> }) {
  const [selected, setSelected] = useState<Key>("grower");
  const [step, setStep] = useState(-1); // -1 = not playing a deal
  const [playing, setPlaying] = useState(false);
  const [seen, setSeen] = useState<Key[]>([]);
  const [reduced, setReduced] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Browser-only state (saved quest progress, reduced-motion preference) is read after hydration.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(QUEST_KEY);
        const saved = raw ? (JSON.parse(raw) as unknown) : null;
        if (Array.isArray(saved)) setSeen(saved.filter((k): k is Key => NODES.some((n) => n.key === k)));
      } catch {}
      setReduced(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const visit = (k: Key) => {
    setSelected(k);
    setSeen((prev) => {
      if (prev.includes(k)) return prev;
      const next = [...prev, k];
      try {
        localStorage.setItem(QUEST_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Auto-advance the deal while playing.
  useEffect(() => {
    if (!playing) return;
    timer.current = setTimeout(() => {
      if (step >= DEAL.length - 1) setPlaying(false);
      else setStep((s) => s + 1);
    }, 3200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, step]);

  const startDeal = () => {
    setStep(0);
    setPlaying(true);
  };
  const deal = step >= 0 ? DEAL[step] : null;
  const node = NODES.find((n) => n.key === selected)!;
  const lit = useMemo(() => new Set<Key>(deal ? [deal.from, deal.to] : [selected, ...node.connects]), [deal, selected, node]);
  const done = step === DEAL.length - 1 && !playing;
  const questDone = seen.length >= NODES.length;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
      {/* ---------- Ecosystem map ---------- */}
      <div className="relative mx-auto aspect-square w-full max-w-[560px] select-none">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true">
          <defs>
            <radialGradient id="hubGlow">
              <stop offset="0%" stopColor="#bc8a2e" stopOpacity=".35" />
              <stop offset="100%" stopColor="#bc8a2e" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r={R} fill="none" stroke="#e2decd" strokeWidth=".35" strokeDasharray="1 1.4" />
          <circle cx="50" cy="50" r="20" fill="url(#hubGlow)" className="motion-safe:animate-pulse" />
          {NODES.map((n) => {
            const p = POS[n.key];
            const on = lit.has(n.key);
            const path = `M${p.x},${p.y} L50,50`;
            return (
              <g key={n.key}>
                <path d={path} stroke={on ? "#bc8a2e" : "#d9d4c0"} strokeWidth={on ? 0.9 : 0.45} strokeLinecap="round" className="transition-all duration-500" />
                {!reduced && !deal && (
                  <>
                    {/* produce / requests flowing in and out of the hub */}
                    <circle r={on ? 1.1 : 0.7} fill={on ? FLOW_COLOR.produce : "#b9c9bd"}>
                      <animateMotion dur={`${2.6 + (n.key.length % 4) * 0.4}s`} repeatCount="indefinite" path={path} />
                    </circle>
                    <circle r={on ? 1.1 : 0.7} fill={on ? FLOW_COLOR.money : "#ddd0ad"}>
                      <animateMotion dur={`${3.1 + (n.key.length % 3) * 0.5}s`} repeatCount="indefinite" path={`M50,50 L${p.x},${p.y}`} begin="1.2s" />
                    </circle>
                  </>
                )}
              </g>
            );
          })}
          {/* the deal token travels from → hub → to */}
          {deal && (
            <circle key={step} r="2.4" fill={FLOW_COLOR[deal.flow]} stroke="#fff" strokeWidth=".6">
              {!reduced && <animateMotion dur="1.6s" fill="freeze" path={`M${POS[deal.from].x},${POS[deal.from].y} L50,50 L${POS[deal.to].x},${POS[deal.to].y}`} />}
            </circle>
          )}
        </svg>

        {/* hub */}
        <button
          type="button"
          onClick={startDeal}
          className="absolute top-1/2 left-1/2 grid size-[27%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-center text-white shadow-[0_10px_30px_-10px_rgba(12,53,32,.7)] ring-4 ring-highlight/40 transition hover:scale-105"
          aria-label="Play a sample deal across the hub"
        >
          <span className="px-2">
            <span className="block font-display text-[clamp(.8rem,3.4vw,1.25rem)] leading-none font-black">AGRI HUB</span>
            <span className="mt-1 block text-[clamp(.66rem,2.4vw,.78rem)] font-semibold text-gold-soft">{deal ? `Step ${step + 1} of ${DEAL.length}` : "Tap to play a deal"}</span>
          </span>
        </button>

        {/* stakeholder nodes */}
        {NODES.map((n) => {
          const p = POS[n.key];
          const on = lit.has(n.key);
          const active = deal ? deal.from === n.key || deal.to === n.key : selected === n.key;
          const Icon = n.icon;
          return (
            <button
              key={n.key}
              type="button"
              onClick={() => {
                setPlaying(false);
                setStep(-1);
                visit(n.key);
              }}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              aria-pressed={selected === n.key && !deal}
              className={`absolute flex w-[19%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-2xl p-1 text-center transition duration-300 ${on ? "opacity-100" : "opacity-45"} ${active ? "scale-110" : "hover:scale-105"}`}
            >
              <span className={`relative grid aspect-square w-[62%] place-items-center rounded-full shadow-sm ring-2 transition ${active ? "bg-highlight text-white ring-highlight" : "bg-white text-primary ring-line"}`}>
                <Icon className="size-[48%]" />
                {seen.includes(n.key) && (
                  <span className="absolute -top-0.5 -right-0.5 grid size-[34%] place-items-center rounded-full bg-leaf text-white ring-2 ring-white">
                    <Check className="size-[70%]" strokeWidth={3} />
                  </span>
                )}
                {active && !reduced && <span className="absolute inset-0 rounded-full ring-4 ring-highlight/40 motion-safe:animate-ping" />}
              </span>
              <span className="text-[clamp(.66rem,2.6vw,.82rem)] leading-tight font-bold text-ink">
                <span className="sm:hidden">{SHORT[n.key] ?? n.label}</span>
                <span className="hidden sm:inline">{n.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ---------- Side panel: role details or the deal story ---------- */}
      <div className="min-w-0 space-y-4">
        {deal ? (
          <div className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow text-leaf!">Play a deal</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPlaying((v) => !v)} disabled={done} className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary disabled:opacity-40" aria-label={playing ? "Pause" : "Play"}>
                  {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
                </button>
                <button type="button" onClick={startDeal} className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary" aria-label="Replay">
                  <RotateCcw className="size-5" />
                </button>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
              <div className="h-full rounded-full bg-highlight transition-all duration-700" style={{ width: `${((step + 1) / DEAL.length) * 100}%` }} />
            </div>
            <ol className="mt-5 space-y-2">
              {DEAL.map((d, i) => (
                <li key={d.title}>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setStep(i);
                    }}
                    className={`flex w-full gap-3 rounded-xl p-3 text-left transition ${i === step ? "bg-highlight-soft ring-1 ring-highlight/40" : "hover:bg-sand/60"}`}
                  >
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black ${i < step || done ? "bg-leaf text-white" : i === step ? "bg-highlight text-white" : "bg-sand text-muted"}`}>
                      {i < step || done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{d.title}</span>
                      {i === step && <span className="mt-0.5 block text-sm text-ink-soft">{d.body}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {done && (
              <div className="mt-4 rounded-xl bg-primary p-4 text-white">
                <p className="flex items-center gap-2 font-semibold">
                  <Trophy className="size-5 text-gold-soft" /> Deal done: BC berries sold to a BC buyer.
                </p>
                <p className="mt-1 text-sm text-white/75">Every deal like this one helps move BC from 77.1% imported vegetables toward 55–60%.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/signup?role=grower" className="rounded-full bg-highlight px-4 py-2.5 text-sm font-semibold text-white">I&apos;m a grower</Link>
                  <Link href="/signup?role=buyer" className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-primary">I&apos;m a buyer</Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card p-6">
            <p className="eyebrow text-leaf!">{counts[node.key] ? `${counts[node.key]} on the hub` : "Stakeholder"}</p>
            <h3 className="mt-1 text-2xl">{node.label}</h3>
            <ul className="mt-4 space-y-2.5">
              {node.does.map((d) => (
                <li key={d} className="flex gap-2.5 text-[15px] text-ink-soft">
                  <Check className="mt-0.5 size-5 shrink-0 text-leaf" /> {d}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs font-bold tracking-wider text-muted uppercase">Connects with</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {node.connects.map((k) => (
                <button key={k} type="button" onClick={() => visit(k)} className="min-h-9 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary hover:text-white">
                  {NODES.find((n) => n.key === k)!.label}
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/signup?role=${node.key}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 font-semibold text-white">
                Join as {node.one} <ArrowRight className="size-4" />
              </Link>
              <Link href={node.page.href} className="inline-flex min-h-11 items-center rounded-full px-4 font-semibold text-leaf ring-1 ring-line hover:bg-sand/60">
                {node.page.label}
              </Link>
            </div>
          </div>
        )}

        {/* Explorer quest */}
        <div className="card flex items-center gap-4 p-5">
          <span className={`grid size-12 shrink-0 place-items-center rounded-full ${questDone ? "bg-highlight text-white" : "bg-sand text-muted"}`}>
            <Trophy className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{questDone ? "Ecosystem Explorer badge unlocked!" : "Explorer quest"}</p>
            <p className="text-sm text-muted">{questDone ? "You've met every stakeholder on the hub." : `Tap all 9 stakeholders to earn the badge: ${seen.length}/9 explored.`}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand">
              <div className="h-full rounded-full bg-leaf transition-all duration-500" style={{ width: `${(seen.length / NODES.length) * 100}%` }} />
            </div>
          </div>
        </div>
        {!deal && (
          <button type="button" onClick={startDeal} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-highlight px-5 font-semibold text-white shadow-sm transition hover:brightness-105">
            <Play className="size-5" /> Play a sample deal
          </button>
        )}
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: FLOW_COLOR.produce }} /> Produce & supply</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: FLOW_COLOR.money }} /> Orders & capital</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: FLOW_COLOR.know }} /> Know-how</span>
        </p>
      </div>
    </div>
  );
}
