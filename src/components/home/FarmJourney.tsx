"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { Play, Pause, RotateCcw, Dices, ChevronLeft, ChevronRight, Sprout, Droplets, Radio, Umbrella, ShieldCheck, Wallet, DollarSign, Gamepad2, Trophy, Cpu, Ban, type LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Illustrative season model for four BC crops.                       */
/* Rounded example numbers for learning, not a forecast.              */
/* ------------------------------------------------------------------ */
export type CropKey = "blueberry" | "potato" | "wheat" | "canola";
export type SellKey = "store" | "distributor" | "local" | "export";

type Crop = {
  label: string;
  /** short name for labels inside the drawing */
  short: string;
  emoji: string;
  place: string;
  acres: number;
  normalKg: number;
  seedLabel: string;
  seedEmoji: string;
  /** set for perennial crops (planted once, harvested every year): explains why there is no seed to buy */
  perennial?: string;
  costs: [string, number][];
  irrigation: string;
  protection: string;
  /** [price $/kg, selling cost $/kg] before weather moves prices */
  prices: Record<SellKey, [number, number]>;
  sell: Record<SellKey, { label: string; emoji: string; note: string }>;
};

const CROPS: Record<CropKey, Crop> = {
  blueberry: {
    label: "Blueberries", short: "Berries", emoji: "🫐", place: "the Fraser Valley", acres: 10, normalKg: 40000, seedLabel: "Pruning & bush care", seedEmoji: "✂️",
    perennial: "Blueberry bushes were planted once and keep producing for 20+ years, so there's no seed or new plants to buy each year. The yearly cost is pruning and caring for the bushes.",
    costs: [["Pruning & bush care", 8000], ["Fertilizer", 12000], ["Machinery & fuel", 22000], ["Labour & picking", 30000]],
    irrigation: "Drip irrigation", protection: "Hail netting",
    prices: { store: [2.3, 0], distributor: [3.3, 0], local: [5.0, 0.6], export: [5.6, 0.7] },
    sell: {
      store: { label: "Cold storage", emoji: "❄️", note: "Least profitable: a quick sale for freezing, at the lowest price." },
      distributor: { label: "Distributor", emoji: "📦", note: "Less profitable: one truck takes it all, but the middleman keeps a cut." },
      local: { label: "Farmers' market", emoji: "🧺", note: "Profitable: top retail prices, sold stall by stall." },
      export: { label: "Export", emoji: "🚢", note: "Most profitable: premium prices abroad, with certification and freight." },
    },
  },
  potato: {
    label: "Potatoes", short: "Potatoes", emoji: "🥔", place: "Delta", acres: 40, normalKg: 600000, seedLabel: "Seed potatoes", seedEmoji: "🥔",
    costs: [["Seed potatoes", 45000], ["Fertilizer", 28000], ["Machinery & fuel", 40000], ["Labour & hauling", 25000]],
    irrigation: "Pivot irrigation", protection: "Crop protection",
    prices: { store: [0.2, 0], distributor: [0.3, 0], local: [0.62, 0.14], export: [0.66, 0.16] },
    sell: {
      store: { label: "Cold storage", emoji: "❄️", note: "Least profitable: sold into storage at the lowest price." },
      distributor: { label: "Distributor", emoji: "📦", note: "Less profitable: easy bulk sale, but the middleman keeps a cut." },
      local: { label: "Farmers' market", emoji: "🧺", note: "Profitable: retail prices, sold bag by bag." },
      export: { label: "Export", emoji: "🚢", note: "Most profitable: seed and table potatoes for buyers abroad." },
    },
  },
  wheat: {
    label: "Wheat", short: "Wheat", emoji: "🌾", place: "the Peace River region", acres: 30, normalKg: 75000, seedLabel: "Seed", seedEmoji: "🌱",
    costs: [["Seed", 3000], ["Fertilizer", 6000], ["Machinery & fuel", 5500], ["Labour & hauling", 2000]],
    irrigation: "Irrigation", protection: "Crop protection",
    prices: { store: [0.26, 0], distributor: [0.3, 0], local: [0.37, 0.02], export: [0.41, 0.04] },
    sell: {
      store: { label: "Grain storage", emoji: "🏚️", note: "Least profitable: sold to the elevator at harvest-time prices." },
      distributor: { label: "Grain buyer", emoji: "📦", note: "Less profitable: a bulk contract, the buyer keeps a margin." },
      local: { label: "Local mill", emoji: "🍞", note: "Profitable: a premium for milling-quality wheat." },
      export: { label: "Export", emoji: "🚢", note: "Most profitable: Pacific ports ship BC wheat to Asia." },
    },
  },
  canola: {
    label: "Canola", short: "Canola", emoji: "🌼", place: "the Peace River region", acres: 30, normalKg: 33000, seedLabel: "Seed", seedEmoji: "🌱",
    costs: [["Seed", 3600], ["Fertilizer", 5500], ["Machinery & fuel", 5000], ["Labour & hauling", 1500]],
    irrigation: "Irrigation", protection: "Crop protection",
    prices: { store: [0.6, 0], distributor: [0.7, 0], local: [0.8, 0.02], export: [0.88, 0.05] },
    sell: {
      store: { label: "Storage bin", emoji: "🛢️", note: "Least profitable: sold off the farm at the lowest bid." },
      distributor: { label: "Grain buyer", emoji: "📦", note: "Less profitable: a bulk contract, the buyer keeps a margin." },
      local: { label: "Local crusher", emoji: "🫙", note: "Profitable: crushed into canola oil close to home." },
      export: { label: "Export", emoji: "🚢", note: "Most profitable: seed and oil shipped to overseas buyers." },
    },
  },
};
const CROP_KEYS = Object.keys(CROPS) as CropKey[];
const SELL_KEYS: SellKey[] = ["store", "distributor", "local", "export"]; // least → most profitable
const DOLLARS: Record<SellKey, number> = { store: 1, distributor: 2, local: 3, export: 4 };

export type TechKey = "irrigation" | "sensors" | "protection" | "insurance";
const TECH_KEYS: TechKey[] = ["irrigation", "sensors", "protection", "insurance"];
const TECH_SHARE: Record<TechKey, number> = { irrigation: 0.11, sensors: 0.05, protection: 0.18, insurance: 0.07 }; // share of base cost
const TECH_ICON: Record<TechKey, LucideIcon> = { irrigation: Droplets, sensors: Radio, protection: Umbrella, insurance: ShieldCheck };
const techLabel = (k: TechKey, c: Crop) => (k === "irrigation" ? c.irrigation : k === "protection" ? c.protection : k === "sensors" ? "Soil & weather sensors" : "Crop insurance");
const TECH_HELPS: Record<TechKey, string> = {
  irrigation: "keeps the crop growing through drought and heat",
  sensors: "times water and fertilizer, and warns of disease early",
  protection: "shields the crop from hail and storm damage",
  insurance: "pays out when a bad year cuts the harvest",
};

export type WeatherKey = "great" | "drought" | "hail" | "rain";
const WEATHER: Record<WeatherKey, { label: string; emoji: string; story: string; sky: [string, string] }> = {
  great: { label: "Great season", emoji: "☀️", story: "Warm days, cool nights and rain at just the right time.", sky: ["#8fd3ff", "#e8f6ff"] },
  drought: { label: "Drought & heat", emoji: "🔥", story: "Weeks without rain and a heat dome. Thirsty plants give up their crop.", sky: ["#ffb36b", "#ffe6c4"] },
  hail: { label: "Hailstorm", emoji: "🧊", story: "A summer hailstorm shreds leaves and smashes the crop in minutes.", sky: ["#7d8a99", "#c9d1da"] },
  rain: { label: "Heavy rain", emoji: "🌧️", story: "Waterlogged fields, mould and rot after weeks of rain.", sky: ["#5d6b78", "#aab6c1"] },
};
const WEATHER_KEYS = Object.keys(WEATHER) as WeatherKey[];
const supplyFactor = (w: WeatherKey) => (w === "great" ? 0.92 : w === "drought" || w === "hail" ? 1.08 : 1);

/** Share of a normal harvest brought in, given the weather and the technology. */
function yieldShare(w: WeatherKey, t: Set<TechKey>) {
  const s = t.has("sensors");
  switch (w) {
    case "great":
      return s ? 1.08 : 1;
    case "drought":
      return (t.has("irrigation") ? 0.88 : 0.45) + (s ? 0.07 : 0);
    case "hail":
      return (t.has("protection") ? 0.6 : 0.3) + (s ? 0.05 : 0);
    case "rain":
      return s ? 0.8 : 0.55;
  }
}

export type Choice = { crop: CropKey; tech: Set<TechKey>; weather: WeatherKey; sell: SellKey };
export function season({ crop, tech, weather, sell }: Choice) {
  const c = CROPS[crop];
  const baseCost = c.costs.reduce((n, [, a]) => n + a, 0);
  const techCost = [...tech].reduce((n, k) => n + baseCost * TECH_SHARE[k], 0);
  const share = yieldShare(weather, tech);
  const kg = c.normalKg * share;
  const f = supplyFactor(weather);
  const net = (k: SellKey) => c.prices[k][0] * f - c.prices[k][1];
  // Hail bruises and smashes produce: only 20% still makes the chosen grade; the rest sells at the lowest price.
  const gradeA = weather === "hail" ? 0.2 : 1;
  const revenue = kg * gradeA * net(sell) + kg * (1 - gradeA) * net("store");
  // Weather insurance pays a set amount in any bad-weather year, so protective technology still pays off on top of it.
  const insurance = tech.has("insurance") && weather !== "great" ? baseCost * 0.15 : 0;
  const profit = revenue + insurance - baseCost - techCost;
  const plainShare = yieldShare(weather, new Set());
  const plainKg = c.normalKg * plainShare;
  const plainProfit = plainKg * gradeA * net("distributor") + plainKg * (1 - gradeA) * net("store") - baseCost;
  return { baseCost, techCost, share, kg, revenue, insurance, profit, net, plainShare, plainProfit, gradeA };
}

const money = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-CA")}`;
const kgText = (n: number) => (n >= 10000 ? `${Math.round(n / 1000).toLocaleString("en-CA")} tonnes` : `${Math.round(n).toLocaleString("en-CA")} kg`);

/* ------------------------------------------------------------------ */
/* Story steps                                                        */
/* ------------------------------------------------------------------ */
const STEPS = [
  { key: "crop", title: "Pick a crop", tag: "🧭 Plan" },
  { key: "invest", title: "Invest", tag: "🌱 Spring" },
  { key: "grow", title: "Plant & grow", tag: "🌿 Spring–summer" },
  { key: "weather", title: "Weather", tag: "⛅ Summer" },
  { key: "harvest", title: "Harvest", tag: "🧺 Harvest" },
  { key: "sell", title: "Sell", tag: "🚚 After harvest" },
  { key: "result", title: "Profit or loss", tag: "💰 Season end" },
  { key: "hub", title: "Where AGRI HUB helps", tag: "🤝 Every step" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];
const idx = (k: StepKey) => STEPS.findIndex((s) => s.key === k);
const DECISIONS: Partial<Record<StepKey, string>> = { crop: "Pick David's crop", invest: "Invest in technology, or not?", weather: "Pick the weather, or roll the dice", sell: "Where should David sell?" };
const STEP_MS = 7000;
const DECIDE_MS = 11000;
/** After the player starts choosing, wait this long without a tap before the story moves on by itself. */
const IDLE_MS = 30000;

const PITCH: Record<StepKey, { who: string; text: string; cta: string; role: string }> = {
  crop: { who: "Growers of every crop", text: "Berries, potatoes, grain or oilseed: list any crop on AGRI HUB and find buyers, programs and partners, free.", cta: "Join as a grower, free", role: "grower" },
  invest: { who: "Lenders, suppliers & dealers", text: "Growers shop for loans, seed, fertilizer and machinery here every spring. List your programs and products where the buying decisions start.", cta: "List your offer, free", role: "supplier" },
  grow: { who: "Ag-tech companies & universities", text: "Growers on the hub want irrigation, sensors and research partners. Offer a demo or a field trial and get real farm feedback.", cta: "Offer a trial, free", role: "agtech" },
  weather: { who: "Insurers, government & consultants", text: "Weather is the farmer's biggest risk. Put insurance, AgriStability and risk-planning help in front of the growers who need it.", cta: "Post your program, free", role: "government" },
  harvest: { who: "Growers", text: "List your harvest with photos, volume and harvest window, and let buyers come to you, with lot traceability built in.", cta: "List your harvest, free", role: "grower" },
  sell: { who: "Buyers, distributors, storage & exporters", text: "Find BC supply fast: send RFQs, post what you need on the demand board and reach 10,000+ Buy BC products.", cta: "Start buying, free", role: "buyer" },
  result: { who: "Consultants & financing partners", text: "Good years and bad years both need planning. Help growers with business plans, grants and financing, and receive them as leads.", cta: "Offer your services, free", role: "consultant" },
  hub: { who: "Every stakeholder", text: "One free membership puts you in front of growers, buyers and partners across BC. No fees and no commission on any deal.", cta: "Join AGRI HUB, free", role: "" },
};

type Played = { crop: CropKey; weather: WeatherKey; tech: number; sell: SellKey; profit: number };
const HISTORY_KEY = "agrihub.seasons.v1";
const BADGES: { key: string; emoji: string; label: string; test: (h: Played[]) => boolean }[] = [
  { key: "storm", emoji: "🌩️", label: "Storm survivor", test: (h) => h.some((p) => p.weather === "hail") },
  { key: "tech", emoji: "🛰️", label: "Tech pioneer", test: (h) => h.some((p) => p.tech === 4 && p.profit > 0) },
  { key: "export", emoji: "🚢", label: "Export champion", test: (h) => h.some((p) => p.sell === "export" && p.profit > 0) },
  { key: "crops", emoji: "🌾", label: "Crop master", test: (h) => CROP_KEYS.every((k) => h.some((p) => p.crop === k)) },
  { key: "big", emoji: "💰", label: "Big season", test: (h) => h.some((p) => p.profit >= 100000) },
];

export function FarmJourney() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [engaged, setEngaged] = useState(false); // the player is choosing at this step: stop the countdown
  const [touches, setTouches] = useState(0); // bumps on every choice, restarting the idle timer
  const [crop, setCrop] = useState<CropKey>("blueberry");
  const [tech, setTech] = useState<Set<TechKey>>(new Set(["irrigation", "insurance"]));
  const [weather, setWeather] = useState<WeatherKey>("drought");
  const [sell, setSell] = useState<SellKey>("local");
  const [history, setHistory] = useState<Played[]>([]);
  const [reduced, setReduced] = useState(false);
  const latest = useRef<Choice>({ crop, tech, weather, sell });
  const loggedRun = useRef(-1);
  const run = useRef(0);

  useEffect(() => {
    latest.current = { crop, tech, weather, sell };
  });

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const r = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      setReduced(r);
      if (r) setPlaying(false);
      try {
        const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as unknown;
        if (Array.isArray(saved)) setHistory(saved.filter((p): p is Played => !!p && typeof p === "object" && "crop" in p && "profit" in p && p.crop in CROPS).slice(-10));
      } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, []);

  /** Move to a step; record the season when the result is reached. */
  const enter = useCallback((next: number) => {
    const n = ((next % STEPS.length) + STEPS.length) % STEPS.length;
    if (STEPS[n]!.key === "crop") run.current += 1;
    if (STEPS[n]!.key === "result" && loggedRun.current !== run.current) {
      loggedRun.current = run.current;
      const c = latest.current;
      const r = season(c);
      setHistory((prev) => {
        const nextH = [...prev, { crop: c.crop, weather: c.weather, tech: c.tech.size, sell: c.sell, profit: Math.round(r.profit) }].slice(-10);
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(nextH));
        } catch {}
        return nextH;
      });
    }
    setEngaged(false);
    setStep(n);
  }, []);

  const autoPick = useCallback((key: StepKey) => {
    const any = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
    if (key === "crop") setCrop(any(CROP_KEYS));
    if (key === "invest") setTech(new Set(any<TechKey[]>([[...TECH_KEYS], [], ["irrigation", "insurance"], ["protection", "sensors"], ["irrigation", "sensors", "insurance"]])));
    if (key === "weather") setWeather(any(WEATHER_KEYS));
    if (key === "sell") setSell(any(SELL_KEYS));
  }, []);

  // Auto-play: story steps advance on a timer; at a decision it waits for the player, then picks for them.
  // Once the player starts choosing, the countdown stops; only a long idle (no taps) moves the story on.
  useEffect(() => {
    if (!playing) return;
    const key = STEPS[step]!.key;
    const decision = !!DECISIONS[key];
    const t = setTimeout(() => {
      if (decision && !engaged) autoPick(key);
      enter(step + 1);
    }, decision ? (engaged ? IDLE_MS : DECIDE_MS) : STEP_MS);
    return () => clearTimeout(t);
  }, [playing, engaged, touches, step, enter, autoPick]);

  /** The player made or changed a choice: stay on this step so they can explore other options. */
  const touch = () => {
    setEngaged(true);
    setTouches((n) => n + 1);
  };
  /** The player is happy with their choice: move the story on and keep it playing. */
  const proceed = () => {
    setPlaying(true);
    enter(step + 1);
  };
  const go = (i: number) => {
    setPlaying(false);
    enter(Math.max(0, Math.min(STEPS.length - 1, i)));
  };
  const restart = () => {
    setPlaying(true);
    enter(0);
  };

  const c = CROPS[crop];
  const m = useMemo(() => season({ crop, tech, weather, sell }), [crop, tech, weather, sell]);
  const allTechCost = TECH_KEYS.reduce((n, k) => n + m.baseCost * TECH_SHARE[k], 0);
  const cur = STEPS[step]!;
  const pitch = PITCH[cur.key];
  const awaiting = DECISIONS[cur.key] ?? null;
  const techNames = [...tech].map((k) => techLabel(k, c).toLowerCase());
  const best = history.length ? history.reduce((a, b) => (b.profit > a.profit ? b : a)) : null;
  const badges = BADGES.filter((b) => b.test(history));

  const story: Record<StepKey, string> = {
    crop: "Meet David, our hero: a BC farmer who feeds us all. This year David must choose what to grow: blueberries, potatoes, wheat or canola. Each crop costs, grows and sells differently.",
    invest: `David is growing ${c.label.toLowerCase()} on ${c.acres} acres in ${c.place}, and invests ${money(m.baseCost + m.techCost)} before earning a dollar: ${c.seedLabel.toLowerCase()}, fertilizer and machinery${techNames.length ? `, plus ${techNames.join(", ")}` : ", with no extra technology"}.${c.perennial ? " The bushes were planted years ago, so there's no seed to buy. As the money goes in, they leaf out for a new season." : " As the money goes in, the first shoots come up."}`,
    grow: `The tractor rolls forward row by row, spraying fertilizer on the ${c.label.toLowerCase()}, and the crop grows.${tech.has("irrigation") ? ` ${c.irrigation} waters the field.` : ""}${tech.has("sensors") ? " Sensors tell David exactly when to feed and water." : ""}${tech.size ? "" : " No technology this year: David is trusting the weather."}`,
    weather: `${WEATHER[weather].emoji} ${WEATHER[weather].label}! ${WEATHER[weather].story} ${weather === "hail" ? (tech.has("protection") ? `${c.protection} saves part of the crop, but it will still be a losing year.` : "Without protection, most of the crop is lost.") : m.share >= 0.85 ? "David's crop holds up well." : m.share >= 0.6 ? "David loses part of the crop." : "It's a hard year: much of the crop is lost."}`,
    harvest: `Harvest! David brings in ${kgText(m.kg)} of ${c.label.toLowerCase()}, ${Math.round(m.share * 100)}% of a normal year.${weather === "hail" ? " Much of it is hail-damaged and can only be sold at the lowest price." : ""}`,
    sell: `Now David has to sell. ${c.sell.store.label} pays least, then a ${c.sell.distributor.label.toLowerCase()}, then the ${c.sell.local.label.toLowerCase()}, and export pays the most. Where will David sell?`,
    result: m.profit >= 0 ? `Season done! After every cost, David made ${money(m.profit)} on ${c.label.toLowerCase()} this year.` : `A losing season: after every cost, David lost ${money(Math.abs(m.profit))} on ${c.label.toLowerCase()} this year.`,
    hub: "David doesn't have to do it alone. AGRI HUB connects growers like David with funding, suppliers, experts, buyers and export partners at every step, for free.",
  };

  return (
    <section className="bg-sand/60" aria-labelledby="journey-title">
      <style>{CSS}</style>
      <div className="container-page py-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-highlight px-3 py-1 text-xs font-black tracking-[0.14em] text-white uppercase shadow-sm">
              <span aria-hidden>🧑‍🌾</span> Farmer Our Hero
            </p>
            <p className="eyebrow mt-2 text-leaf!">Play a season on a BC farm</p>
            <h2 id="journey-title" className="mt-1 text-2xl sm:text-[2.2rem]">Can you help David turn a profit?</h2>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPlaying((p) => !p)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-white" aria-label={playing ? "Pause the story" : "Play the story"}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />} {playing ? "Pause" : "Play"}
            </button>
            <button type="button" onClick={restart} className="grid size-11 place-items-center rounded-full bg-white text-primary ring-1 ring-line" aria-label="New season">
              <RotateCcw className="size-4" />
            </button>
          </div>
        </div>

        {/* step rail */}
        <ol className="mt-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {STEPS.map((s, i) => (
            <li key={s.key} className="min-w-[80px] flex-1">
              <button type="button" onClick={() => go(i)} className="min-h-11 w-full py-2 text-left" aria-current={i === step ? "step" : undefined}>
                <span className="block h-1.5 overflow-hidden rounded-full bg-line">
                  <span key={i === step ? `${step}-${playing}-${engaged}` : undefined} className={`block h-full rounded-full ${DECISIONS[s.key] ? "bg-leaf" : "bg-highlight"} ${i < step ? "w-full" : i === step ? (playing && !engaged && !reduced ? (DECISIONS[s.key] ? "fj-fill-long" : "fj-fill") : "w-full") : "w-0"}`} />
                </span>
                <span className={`mt-1.5 block text-[11px] font-bold tracking-wide uppercase ${i === step ? "text-primary" : "text-muted"}`}>
                  {DECISIONS[s.key] ? "🎮 " : ""}
                  {s.title}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:gap-6">
          {/* ---------------- the story: scene + David's speech bubble ---------------- */}
          <div className="min-w-0">
            {/* season, crop and weather chips sit above the picture so they never cover the drawing */}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-primary shadow-sm ring-1 ring-line">
                {cur.tag}
                {step > 0 ? ` · ${c.emoji} ${c.label}` : ""}
              </span>
              {step >= idx("weather") && step <= idx("result") && (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink shadow-sm ring-1 ring-line">
                  {WEATHER[weather].emoji} {WEATHER[weather].label}
                </span>
              )}
            </div>
            <div className="relative overflow-hidden rounded-[18px] ring-1 ring-line">
              <Scene crop={crop} stepKey={cur.key} weather={weather} tech={tech} share={m.share} sell={sell} profit={m.profit} reduced={reduced} />
            </div>
            <div className="relative mt-3 flex gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-line sm:p-4" aria-live="polite">
              <span className="absolute -top-2 left-8 size-4 rotate-45 bg-white ring-1 ring-line [clip-path:polygon(0_0,100%_0,0_100%)]" aria-hidden />
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft">
                <svg viewBox="-16 -70 32 34" className="size-9" aria-hidden>
                  <FarmerHead mood={(cur.key === "result" && m.profit < 0) || (cur.key === "weather" && m.share < 0.7) ? "sad" : "happy"} />
                </svg>
              </span>
              <p className="min-w-0 text-[15px] leading-snug text-ink-soft">
                <strong className="text-primary">David: </strong>
                <span key={`${step}-${crop}-${weather}-${sell}-${tech.size}`} className={reduced ? "" : "fj-type"}>{story[cur.key]}</span>
              </p>
            </div>
          </div>

          {/* ---------------- the player's moves ---------------- */}
          <div className="card min-w-0 p-4 sm:p-6">
            {awaiting && (
              <div className="mb-3 overflow-hidden rounded-xl bg-leaf text-white">
                <p className="flex items-center gap-2 px-3 py-2 text-sm font-bold">
                  <Gamepad2 className={`size-5 shrink-0 ${engaged ? "" : "fj-wiggle"}`} /> {engaged ? "Take your time: try other options, then tap Continue." : `Your move: ${awaiting}`}
                </p>
                {playing && !engaged && !reduced && <span key={step} className="fj-countdown block h-1 bg-gold-soft" />}
              </div>
            )}
            <p className="text-xs font-bold tracking-wider text-highlight uppercase">Step {step + 1} of {STEPS.length}</p>
            <h3 className="mt-1 text-xl sm:text-2xl">{cur.title}</h3>

            {cur.key === "crop" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {CROP_KEYS.map((k) => {
                  const cc = CROPS[k];
                  const on = crop === k;
                  return (
                    <button key={k} type="button" aria-pressed={on} onClick={() => { setCrop(k); touch(); }} className={`min-h-20 rounded-2xl p-3 text-left ring-1 transition ${on ? "bg-primary text-white ring-primary" : "bg-white ring-line hover:ring-primary/40"}`}>
                      <span className="text-3xl" aria-hidden>{cc.emoji}</span>
                      <span className="mt-1 block font-semibold">{cc.label}</span>
                      <span className={`block text-xs ${on ? "text-white/75" : "text-muted"}`}>{cc.acres} acres · {cc.place.replace("the ", "")}</span>
                    </button>
                  );
                })}
                <ContinueButton onClick={proceed} label={`Grow ${c.label.toLowerCase()}`} />
              </div>
            )}

            {cur.key === "invest" && (
              <div className="mt-3 space-y-3">
                {c.perennial && <p className="rounded-xl bg-primary-soft px-3 py-2 text-sm text-ink-soft">🫐 {c.perennial}</p>}
                <ul className="grid grid-cols-2 gap-2 text-sm">
                  {c.costs.map(([label, amount]) => (
                    <li key={label} className="rounded-xl bg-sand/70 px-3 py-2">
                      <span className="block text-xs text-muted">{label}</span>
                      <strong>{money(amount)}</strong>
                    </li>
                  ))}
                </ul>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => { setTech(new Set(TECH_KEYS)); touch(); }} className={`flex min-h-14 items-center gap-2.5 rounded-xl px-3 py-2 text-left ring-2 transition ${tech.size === 4 ? "bg-primary text-white ring-primary" : "bg-white ring-leaf/40 hover:ring-leaf"}`}>
                    <Cpu className="size-6 shrink-0 text-highlight" />
                    <span>
                      <span className="block font-semibold">Invest in technology</span>
                      <span className={`block text-xs ${tech.size === 4 ? "text-white/75" : "text-muted"}`}>All 4 for +{money(allTechCost)}</span>
                    </span>
                  </button>
                  <button type="button" onClick={() => { setTech(new Set()); touch(); }} className={`flex min-h-14 items-center gap-2.5 rounded-xl px-3 py-2 text-left ring-2 transition ${tech.size === 0 ? "bg-primary text-white ring-primary" : "bg-white ring-line hover:ring-primary/40"}`}>
                    <Ban className="size-6 shrink-0 text-danger" />
                    <span>
                      <span className="block font-semibold">No technology</span>
                      <span className={`block text-xs ${tech.size === 0 ? "text-white/75" : "text-muted"}`}>Save money, risk the weather</span>
                    </span>
                  </button>
                </div>
                <p className="text-xs font-bold tracking-wider text-muted uppercase">Or pick your own</p>
                <div className="grid grid-cols-2 gap-2">
                  {TECH_KEYS.map((k) => {
                    const on = tech.has(k);
                    const Icon = TECH_ICON[k];
                    return (
                      <button key={k} type="button" aria-pressed={on} onClick={() => { setTech((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; }); touch(); }} className={`flex min-h-12 items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] ring-1 transition sm:text-sm ${on ? "bg-primary text-white ring-primary" : "bg-white ring-line hover:ring-primary/40"}`}>
                        <Icon className={`size-5 shrink-0 ${on ? "text-gold-soft" : "text-leaf"}`} />
                        <span className="min-w-0">
                          <span className="block leading-tight font-semibold">{techLabel(k, c)}</span>
                          <span className={`block text-xs ${on ? "text-white/75" : "text-muted"}`}>+{money(m.baseCost * TECH_SHARE[k])}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-highlight-soft px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Wallet className="size-4 shrink-0 text-highlight" /> Invested: {money(m.baseCost + m.techCost)}
                  </span>
                  <button type="button" onClick={proceed} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-white">
                    Plant it: continue <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {cur.key === "grow" && (
              <ul className="mt-3 space-y-2 text-sm">
                {TECH_KEYS.map((k) => {
                  const Icon = TECH_ICON[k];
                  return (
                    <li key={k} className={`flex gap-2 rounded-xl p-2 ${tech.has(k) ? "bg-primary-soft" : "opacity-50"}`}>
                      <Icon className="mt-0.5 size-4 shrink-0 text-leaf" />
                      <span><strong>{techLabel(k, c)}</strong>{tech.has(k) ? ` ${TECH_HELPS[k]}.` : " (not bought this year)"}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {cur.key === "weather" && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {WEATHER_KEYS.map((k) => (
                    <button key={k} type="button" onClick={() => { setWeather(k); touch(); }} aria-pressed={weather === k} className={`min-h-12 rounded-xl px-3 py-2 text-left text-sm font-semibold ring-1 transition ${weather === k ? "bg-primary text-white ring-primary" : "bg-white ring-line"}`}>
                      <span className="mr-1 text-lg" aria-hidden>{WEATHER[k].emoji}</span> {WEATHER[k].label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => { setWeather(WEATHER_KEYS[Math.floor(Math.random() * WEATHER_KEYS.length)]!); touch(); }} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-highlight px-4 text-sm font-semibold text-white">
                  <Dices className="size-4" /> Roll the dice
                </button>
                <ContinueButton onClick={proceed} label="See the harvest" />
              </div>
            )}

            {cur.key === "harvest" && (
              <div className="mt-3 space-y-3">
                <Bar label="David's farm" value={m.share} amount={kgText(m.kg)} tone="bg-leaf" />
                <Bar label="Same farm, no technology" value={m.plainShare} amount={kgText(c.normalKg * m.plainShare)} tone="bg-muted/50" />
                <p className="text-xs text-muted">A normal year is about {kgText(c.normalKg)} from {c.acres} acres.</p>
              </div>
            )}

            {cur.key === "sell" && (
              <div className="mt-3 grid gap-2">
                {[...SELL_KEYS].reverse().map((k) => {
                  const s = c.sell[k];
                  const on = sell === k;
                  return (
                    <button key={k} type="button" onClick={() => { setSell(k); touch(); }} aria-pressed={on} className={`flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 text-left ring-1 transition ${on ? "bg-primary text-white ring-primary" : "bg-white ring-line"}`}>
                      <span className="text-2xl" aria-hidden>{s.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="font-semibold">{s.label}</span>
                          <Dollars n={DOLLARS[k]} on={on} />
                        </span>
                        <span className={`block text-xs leading-snug ${on ? "text-white/80" : "text-muted"}`}>{s.note}</span>
                      </span>
                    </button>
                  );
                })}
                <ContinueButton onClick={proceed} label={`Sell to ${c.sell[sell].label.toLowerCase()}`} />
              </div>
            )}

            {cur.key === "result" && (
              <div className="mt-3 space-y-3">
                <div className={`rounded-2xl p-4 text-white ${m.profit >= 0 ? "bg-leaf" : "bg-danger"}`}>
                  <p className="text-sm font-semibold opacity-85">{m.profit >= 0 ? "David made money this season" : "David lost money this season"}</p>
                  <p className="font-display text-4xl font-black">{money(m.profit)}</p>
                  <p className="mt-1 text-xs opacity-85">{c.emoji} {c.label} · {WEATHER[weather].label.toLowerCase()} · {tech.size ? `${tech.size} technologies` : "no technology"} · {c.sell[sell].label.toLowerCase()}</p>
                </div>
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted">Sales ({kgText(m.kg)}{m.gradeA < 1 ? ", mostly hail-damaged" : ""})</dt>
                  <dd className="text-right font-semibold">{money(m.revenue)}</dd>
                  {m.insurance > 0 && (
                    <>
                      <dt className="text-muted">Insurance payout</dt>
                      <dd className="text-right font-semibold">{money(m.insurance)}</dd>
                    </>
                  )}
                  <dt className="text-muted">Costs incl. technology</dt>
                  <dd className="text-right font-semibold">−{money(m.baseCost + m.techCost)}</dd>
                  <dt className="text-muted">Same farm, no tech, via {c.sell.distributor.label.toLowerCase()}</dt>
                  <dd className={`text-right font-semibold ${m.plainProfit >= 0 ? "text-leaf" : "text-danger"}`}>{money(m.plainProfit)}</dd>
                </dl>
                {history.length > 0 && (
                  <div className="rounded-xl bg-sand/70 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-bold"><Trophy className="size-4 text-highlight" /> Your seasons</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {history.slice(-4).reverse().map((p, i) => (
                        <li key={i} className="flex items-center justify-between gap-2">
                          <span className="min-w-0">{CROPS[p.crop].emoji} {WEATHER[p.weather].emoji} {p.tech ? `🛰️×${p.tech}` : "no tech"} · {CROPS[p.crop].sell[p.sell].label}</span>
                          <strong className={`shrink-0 ${p.profit >= 0 ? "text-leaf" : "text-danger"}`}>{money(p.profit)}</strong>
                        </li>
                      ))}
                    </ul>
                    {best && <p className="mt-2 text-xs text-muted">Best season: {CROPS[best.crop].emoji} {money(best.profit)}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {BADGES.map((b) => {
                        const got = badges.includes(b);
                        return (
                          <span key={b.key} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${got ? "bg-highlight text-white" : "bg-white text-muted opacity-60"}`} title={got ? "Unlocked" : "Locked"}>
                            {b.emoji} {b.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <button type="button" onClick={restart} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-highlight px-4 text-sm font-semibold text-white">
                  <RotateCcw className="size-4" /> Play another season
                </button>
              </div>
            )}

            {cur.key === "hub" && (
              <ul className="mt-3 space-y-2 text-sm">
                {[
                  ["Invest", "Loans, grants and leases from FCC, EDC and BC/federal programs", "/resources"],
                  ["Buy inputs & tech", "Suppliers, dealers and ag-tech trials", "/directory"],
                  ["Grow better", "Consultants, universities and field days", "/events"],
                  ["Weather risk", "Insurance and AgriStability programs", "/resources"],
                  ["Sell", "Buyers, RFQs and the demand board", "/demand"],
                  ["Store & export", "Storage, distributors and export partners", "/directory?tab=processors"],
                ].map(([t, b, h]) => (
                  <li key={t}>
                    <Link href={h!} className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 ring-1 ring-line transition hover:bg-sand/60">
                      <Sprout className="size-4 shrink-0 text-leaf" />
                      <span><strong>{t}:</strong> {b} →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {/* membership pitch for the stakeholder who matters at this step */}
            <div className="mt-4 rounded-2xl bg-primary p-4 text-white">
              <p className="text-[11px] font-bold tracking-wider text-gold-soft uppercase">For {pitch.who}</p>
              <p className="mt-1 text-sm text-white/85">{pitch.text}</p>
              <Link href={pitch.role ? `/signup?role=${pitch.role}` : "/signup"} className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-full bg-highlight px-4 text-sm font-semibold text-white">
                {pitch.cta} <ChevronRight className="size-4" />
              </Link>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
              <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-primary ring-1 ring-line disabled:opacity-35">
                <ChevronLeft className="size-4" /> Back
              </button>
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={() => go(step + 1)} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-white">
                  Next: {STEPS[step + 1]!.title} <ChevronRight className="size-4" />
                </button>
              ) : (
                <button type="button" onClick={restart} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-white">
                  <RotateCcw className="size-4" /> Play again
                </button>
              )}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">Illustrative examples for BC farms. Costs, yields and prices are rounded for learning, not a forecast.</p>
      </div>
    </section>
  );
}

function ContinueButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="col-span-full inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
      {label} <ChevronRight className="size-4" />
    </button>
  );
}

function Dollars({ n, on }: { n: number; on: boolean }) {
  return (
    <span className="inline-flex" aria-label={`${n} of 4 for profit`}>
      {Array.from({ length: 4 }, (_, i) => (
        <DollarSign key={i} className={`size-4 ${i < n ? (on ? "text-gold-soft" : "text-highlight") : on ? "text-white/25" : "text-line"}`} strokeWidth={3} />
      ))}
    </span>
  );
}

function Bar({ label, value, amount, tone }: { label: string; value: number; amount: string; tone: string }) {
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-x-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span>{Math.round(value * 100)}% · {amount}</span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full bg-sand">
        <div className={`h-full rounded-full ${tone} transition-all duration-700`} style={{ width: `${Math.min(100, value * 92)}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Characters and machines (all face right, so they move forward)     */
/* ------------------------------------------------------------------ */
type Mood = "happy" | "sad";
type Pose = "idle" | "invest" | "pick" | "cheer" | "worried";

function FarmerHead({ mood }: { mood: Mood }) {
  return (
    <g>
      <circle cx="0" cy="-51" r="8" fill="#e3a86b" />
      <circle cx="-3" cy="-52" r="1.1" fill="#2b1d12" />
      <circle cx="3" cy="-52" r="1.1" fill="#2b1d12" />
      <path d={mood === "happy" ? "M-3.2 -47.5 q3.2 3.2 6.4 0" : "M-3.2 -46 q3.2 -2.6 6.4 0"} stroke="#7a3b1f" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <ellipse cx="0" cy="-57.5" rx="13" ry="3" fill="#c8963e" />
      <rect x="-7" y="-66" width="14" height="9" rx="3" fill="#d9a74a" />
      <rect x="-7" y="-59" width="14" height="2" fill="#8a5a1f" />
    </g>
  );
}

function BasketGoods({ crop }: { crop: CropKey }) {
  if (crop === "potato") return <>{[-3.5, 0.5, 4].map((x, i) => <ellipse key={i} cx={x} cy={-1} rx="2.4" ry="1.8" fill="#b98a56" stroke="#8a6239" strokeWidth=".4" />)}</>;
  if (crop === "wheat") return <>{[-4, -2, 0, 2, 4].map((x) => <g key={x}><line x1={x} y1="2" x2={x * 1.3} y2="-8" stroke="#c9a23e" strokeWidth=".8" /><ellipse cx={x * 1.3} cy="-9.5" rx=".9" ry="2.2" fill="#d4a634" /></g>)}</>;
  if (crop === "canola") return <>{[-4, -1, 2, 4.5].map((x) => <g key={x}><line x1={x} y1="2" x2={x} y2="-7" stroke="#6f8f3a" strokeWidth=".8" /><circle cx={x} cy="-7.5" r="1.6" fill="#f6d417" /></g>)}</>;
  return <>{[-3, 0.5, 4].map((x, i) => <circle key={i} cx={x} cy={-0.8} r="1.8" fill="#3d4fa8" />)}</>;
}

function Farmer({ x, y, s, pose, mood, crop, anim }: { x: number; y: number; s: number; pose: Pose; mood: Mood; crop: CropKey; anim: boolean }) {
  const arm = (x1: number, y1: number, x2: number, y2: number, k: string) => (
    <g key={k}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c0392b" strokeWidth="5" strokeLinecap="round" />
      <circle cx={x2} cy={y2} r="2.6" fill="#e3a86b" />
    </g>
  );
  const arms: Record<Pose, ReactNode> = {
    idle: [arm(-9, -40, -13, -25, "l"), arm(9, -40, 16, -48, "r")],
    invest: [arm(-9, -40, -13, -25, "l"), arm(9, -40, 19, -36, "r")],
    pick: [arm(-9, -40, -12, -27, "l"), arm(9, -40, 16, -29, "r")],
    cheer: [arm(-9, -40, -16, -56, "l"), arm(9, -40, 16, -56, "r")],
    worried: [arm(-9, -40, -13, -25, "l"), arm(9, -40, 5, -57, "r")],
  };
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={anim ? "fj-bob" : ""}>
        <rect x="-7.5" y="-21" width="6" height="19" fill="#2b3f6b" />
        <rect x="1.5" y="-21" width="6" height="19" fill="#2b3f6b" />
        <rect x="-9" y="-3" width="8" height="3.5" rx="1" fill="#5a3a1f" />
        <rect x="1" y="-3" width="8" height="3.5" rx="1" fill="#5a3a1f" />
        <rect x="-10" y="-42" width="20" height="23" rx="4" fill="#c0392b" />
        <rect x="-8.5" y="-36" width="17" height="17" rx="3" fill="#3b6db3" />
        <line x1="-6" y1="-42" x2="-6" y2="-36" stroke="#3b6db3" strokeWidth="2.4" />
        <line x1="6" y1="-42" x2="6" y2="-36" stroke="#3b6db3" strokeWidth="2.4" />
        {arms[pose]}
        {pose === "invest" && (
          <g transform="translate(22 -36)" className={anim ? "fj-shake" : ""}>
            <circle r="6.5" fill="#bc8a2e" stroke="#8a5a1f" strokeWidth=".8" />
            <path d="M-3 -6 q3 -3 6 0" stroke="#8a5a1f" strokeWidth="1.2" fill="none" />
            <text y="2.6" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#fff">$</text>
          </g>
        )}
        {pose === "pick" && (
          <g transform="translate(18 -30)">
            <BasketGoods crop={crop} />
            <path d="M-7 0 h14 l-2 7 h-10z" fill="#a0692e" />
          </g>
        )}
        <FarmerHead mood={mood} />
      </g>
    </g>
  );
}

function Wheel({ cx, cy, r, anim }: { cx: number; cy: number; r: number; anim: boolean }) {
  return (
    <g className={anim ? "fj-wheel" : ""}>
      <circle cx={cx} cy={cy} r={r} fill="#222" />
      <circle cx={cx} cy={cy} r={r * 0.38} fill="#d9d9d9" />
      <line x1={cx} y1={cy - r * 0.85} x2={cx} y2={cy + r * 0.85} stroke="#555" strokeWidth="1.1" />
    </g>
  );
}

function Tractor({ load, crop, spray, anim }: { load?: number; crop?: CropKey; spray?: boolean; anim: boolean }) {
  return (
    <g>
      {spray && (
        <g>
          {/* fertilizer tank on a trailer, with a spray boom and nozzles */}
          <line x1="-4" y1="-10" x2="4" y2="-10" stroke="#444" strokeWidth="1.5" />
          <rect x="-30" y="-24" width="26" height="13" rx="6" fill="#f2f2f2" stroke="#8aa0b0" strokeWidth="1" />
          <text x="-17" y="-15" textAnchor="middle" fontSize="5.5" fontWeight="900" fill="#1e7a3c">NPK</text>
          <circle cx="-17" cy="-6" r="4.5" fill="#222" />
          <rect x="-44" y="-10" width="42" height="1.8" fill="#666" />
          <g className={anim ? "fj-sprayon" : ""}>
          {[-42, -34, -26, -18, -10].map((nx, i) => (
            <g key={nx}>
              <rect x={nx - 0.8} y="-8.4" width="1.6" height="2.4" fill="#444" />
              <path d={`M${nx} -6 L${nx - 3.5} 6 L${nx + 3.5} 6 Z`} fill="#bfe3ff" opacity=".45" />
              {anim &&
                [0, 1, 2].map((d) => (
                  <circle key={d} cx={nx + (d - 1) * 1.6} cy="-5" r=".9" fill="#5bb2ff" className="fj-spray" style={{ animationDelay: `${(i * 0.13 + d * 0.27) % 0.8}s` }} />
                ))}
            </g>
          ))}
          </g>
        </g>
      )}
      {load ? (
        <g>
          <line x1="-4" y1="-10" x2="4" y2="-10" stroke="#444" strokeWidth="1.5" />
          <rect x="-38" y="-16" width="34" height="8" rx="1.5" fill="#8a5a2b" />
          <circle cx="-21" cy="-6" r="4.5" fill="#222" />
          {Array.from({ length: load }, (_, i) => (
            <g key={i} transform={`translate(${-36 + (i % 3) * 11} ${-24 - Math.floor(i / 3) * 8})`}>
              <rect width="10" height="8" rx="1" fill="#d39b52" stroke="#8a5a2b" strokeWidth=".6" />
              {crop === "potato" ? (
                <>
                  <ellipse cx="3" cy="2.6" rx="2" ry="1.5" fill="#b98a56" />
                  <ellipse cx="7" cy="2.8" rx="2" ry="1.5" fill="#a87a48" />
                </>
              ) : (
                <>
                  <circle cx="3" cy="2.5" r="1.4" fill="#3d4fa8" />
                  <circle cx="6.5" cy="2.5" r="1.4" fill="#3d4fa8" />
                </>
              )}
            </g>
          ))}
        </g>
      ) : null}
      <rect x="2" y="-38" width="17" height="3" rx="1" fill="#2e8b3a" />
      <rect x="4" y="-36" width="13" height="13" fill="#cfe8ff" stroke="#2e8b3a" strokeWidth="1.6" />
      <rect x="2" y="-24" width="36" height="12" rx="2" fill="#2e8b3a" />
      <rect x="27" y="-21" width="13" height="8" rx="1.5" fill="#3aa64a" />
      <rect x="31" y="-31" width="2.2" height="9" fill="#444" />
      {anim && <circle cx="32" cy="-34" r="2.4" fill="#ddd" className="fj-smoke" />}
      <Wheel cx={11} cy={-11} r={11} anim={anim} />
      <Wheel cx={35} cy={-6} r={6} anim={anim} />
    </g>
  );
}

/** Combine harvester for grain and oilseed, header and reel at the front (right). */
function Combine({ crop, anim }: { crop: CropKey; anim: boolean }) {
  return (
    <g>
      <line x1="10" y1="-40" x2="-12" y2="-48" stroke="#2a7c33" strokeWidth="3" strokeLinecap="round" />
      <rect x="2" y="-42" width="24" height="10" rx="2" fill={crop === "canola" ? "#3a3a2a" : "#d9b04a"} />
      <rect x="0" y="-33" width="46" height="23" rx="3" fill="#2f8f3a" />
      <rect x="30" y="-48" width="15" height="15" fill="#cfe8ff" stroke="#2a7c33" strokeWidth="1.6" />
      <rect x="28" y="-50" width="19" height="3" rx="1" fill="#2a7c33" />
      <rect x="46" y="-15" width="22" height="7" rx="1.5" fill="#2a7c33" />
      <g className={anim ? "fj-wheel" : ""}>
        <circle cx="58" cy="-19" r="6.5" fill="none" stroke="#e0c040" strokeWidth="1.4" />
        <line x1="51.5" y1="-19" x2="64.5" y2="-19" stroke="#e0c040" strokeWidth="1" />
        <line x1="58" y1="-25.5" x2="58" y2="-12.5" stroke="#e0c040" strokeWidth="1" />
      </g>
      <Wheel cx={14} cy={-10} r={10} anim={anim} />
      <Wheel cx={40} cy={-6} r={6} anim={anim} />
    </g>
  );
}

function Truck({ anim }: { anim: boolean }) {
  return (
    <g>
      <rect x="0" y="-30" width="42" height="22" rx="2" fill="#fff" stroke="#0c3520" strokeWidth="1.2" />
      <text x="21" y="-16" textAnchor="middle" fontSize="7" fontWeight="900" fill="#0c3520">AGRI HUB</text>
      <path d="M42 -24 h10 l6 8 v8 h-16z" fill="#1e7a3c" />
      <rect x="45" y="-22" width="7" height="6" fill="#cfe8ff" />
      <Wheel cx={10} cy={-6} r={6} anim={anim} />
      <Wheel cx={50} cy={-6} r={6} anim={anim} />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Crops                                                              */
/* ------------------------------------------------------------------ */
type Phase = "young" | "bloom" | "ripe" | "done";
type Cond = "ok" | "dry" | "hurt";

const LEAVES: [number, number, number][] = [
  [-6, -6, -30], [-5, -10, -50], [-2, -13, -70], [2, -14, 70], [5, -11, 45], [6, -7, 25], [-3, -8, -20], [3, -8, 20],
  [0, -10, 90], [-7, -9, -60], [7, -10, 60], [-1, -5, 0], [2, -5, 10], [-4, -12, -80], [4, -13, 80], [0, -15, 85],
];
function BushDef({ id, dark, mid, light, sparse = false }: { id: string; dark: string; mid: string; light: string; sparse?: boolean }) {
  return (
    <g id={id}>
      <path d="M0 0 L-3 -4 M0 0 L0 -5 M0 0 L3 -4" stroke="#6b4a2b" strokeWidth="1" strokeLinecap="round" />
      <ellipse cx="0" cy="-6.5" rx="9.5" ry="6.5" fill={dark} />
      <ellipse cx="-4.5" cy="-8.5" rx="5.5" ry="5" fill={dark} />
      <ellipse cx="4.5" cy="-9" rx="5.5" ry="5.2" fill={dark} />
      {LEAVES.filter((_, i) => !sparse || i % 3 !== 0).map(([cx, cy, r], i) => (
        <ellipse key={i} cx={cx * 1.25} cy={cy + 2.5} rx="3" ry="1.5" fill={i % 3 === 0 ? light : mid} transform={`rotate(${r} ${cx * 1.25} ${cy + 2.5})`} />
      ))}
    </g>
  );
}
const CLUSTERS: [number, number][] = [[-4, -5], [3, -4.5], [5, -9], [-6, -9], [0, -7.5]];

/** Short stubble left after grain or oilseed is cut. */
function Stubble({ color }: { color: string }) {
  return <>{[-2, -1, 0, 1, 2].map((i) => <line key={i} x1={i * 2.4} y1="0" x2={i * 2.4 + 0.4} y2="-3.2" stroke={color} strokeWidth=".9" />)}</>;
}

/** Wraps the part of a plant that gets harvested: it vanishes when the machine reaches this plant. */
function Harvestable({ delay, children }: { delay?: number; children: ReactNode }) {
  return delay === undefined ? <>{children}</> : <g className="fj-gone" style={{ animationDelay: `${delay}s` }}>{children}</g>;
}

function Plant({ crop, phase, cond, n, harvestDelay }: { crop: CropKey; phase: Phase; cond: Cond; n: number; harvestDelay?: number }) {
  if (crop === "blueberry") {
    return (
      <g>
        <use href={cond === "hurt" ? "#fj-bush-hurt" : cond === "dry" ? "#fj-bush-dry" : "#fj-bush-ok"} />
        {(phase === "bloom" || phase === "ripe") && (
          <Harvestable delay={phase === "ripe" ? harvestDelay : undefined}>
            {CLUSTERS.slice(0, n).map(([x, y], i) => (
              <g key={i}>
                {[[0, 0], [1.9, 0.4], [0.9, 1.6]].map(([dx, dy], k) => (
                  <g key={k}>
                    <circle cx={x + dx} cy={y + dy} r="1.15" fill={phase === "ripe" ? (k === 2 && i % 2 ? "#5b3f8f" : "#34428f") : k === 1 ? "#c86d8a" : "#9cbf5a"} />
                    {phase === "ripe" && <circle cx={x + dx - 0.35} cy={y + dy - 0.35} r=".38" fill="#a9b6ee" />}
                  </g>
                ))}
              </g>
            ))}
          </Harvestable>
        )}
      </g>
    );
  }
  if (crop === "wheat") {
    if (phase === "done") return <Stubble color={cond === "hurt" ? "#a88f52" : "#c9a24a"} />;
    const ripe = phase === "ripe";
    const stalk = cond === "dry" ? "#bdb366" : ripe ? (cond === "hurt" ? "#b8995a" : "#d6ad48") : "#5f9e3f";
    const head = ripe ? "#c79a32" : cond === "dry" ? "#c2b569" : "#8dbb55";
    return (
      <g>
        {ripe && harvestDelay !== undefined && <Stubble color="#c9a24a" />}
        <Harvestable delay={ripe ? harvestDelay : undefined}>
        {[-2, -1, 0, 1, 2].map((i) => {
          const h = (cond === "dry" ? 11 : 16) - Math.abs(i) * 1.2;
          const lean = cond === "hurt" ? 7 + i * 2 : i * 1.2;
          const bent = cond === "hurt" && i % 2 === 0;
          const x = i * 2.4;
          const tipY = bent ? -h * 0.55 : -h;
          return (
            <g key={i}>
              <path d={`M${x} 0 Q${x + lean * 0.3} ${-h / 2} ${x + lean} ${tipY}`} stroke={stalk} strokeWidth=".9" fill="none" />
              {phase !== "young" && !(cond === "hurt" && i === 1) && (
                <g>
                  <ellipse cx={x + lean} cy={tipY - 2.4} rx="1.15" ry="2.7" fill={head} transform={`rotate(${lean * 3} ${x + lean} ${tipY - 2.4})`} />
                  {ripe && <line x1={x + lean} y1={tipY - 4.8} x2={x + lean + 0.8} y2={tipY - 8} stroke={head} strokeWidth=".35" />}
                </g>
              )}
            </g>
          );
        })}
        <path d="M-3 0 q-3 -3 -5 -3 M3 0 q3 -3 5 -3" stroke={stalk} strokeWidth=".8" fill="none" />
        </Harvestable>
      </g>
    );
  }
  if (crop === "canola") {
    if (phase === "done") return <Stubble color="#8f8a48" />;
    const leaf = cond === "dry" ? "#a4a85a" : phase === "ripe" ? "#8c9a4a" : "#4e8f3a";
    const top = cond === "hurt" ? { x: 6, y: -10 } : { x: 0, y: -16 };
    return (
      <g>
        {phase === "ripe" && harvestDelay !== undefined && <Stubble color="#8f8a48" />}
        <Harvestable delay={phase === "ripe" ? harvestDelay : undefined}>
        <path d={`M0 0 Q${top.x * 0.2} ${top.y / 2} ${top.x} ${top.y}`} stroke={leaf} strokeWidth="1.1" fill="none" />
        {[[-3, -4, -30], [3, -7, 30], [-2.5, -10, -25]].map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx="3.2" ry="1.4" fill={leaf} transform={`rotate(${r} ${x} ${y})`} />
        ))}
        {phase === "bloom" &&
          (cond === "hurt" ? [[0, 0]] : [[0, 0], [2.4, 0.8], [-2.4, 0.8], [1.2, -2], [-1.2, -2], [0, 2]]).map(([dx, dy], i) => (
            <circle key={i} cx={top.x + dx} cy={top.y + dy} r="1.6" fill="#f6d417" />
          ))}
        {phase === "ripe" &&
          [-30, -10, 10, 30].map((r) => <line key={r} x1={top.x} y1={top.y} x2={top.x + Math.sin((r * Math.PI) / 180) * 5} y2={top.y - Math.cos((r * Math.PI) / 180) * 5} stroke="#9a8f45" strokeWidth=".9" strokeLinecap="round" />)}
        </Harvestable>
      </g>
    );
  }
  // potato
  if (phase === "done") return null;
  const leaf = cond === "dry" ? "#9aa257" : cond === "hurt" ? "#5d6f3a" : phase === "ripe" ? "#a9a24e" : "#3f8a3c";
  const spots = cond === "hurt" ? [[-4, -4], [0, -6], [4, -4]] : [[-4.5, -4], [0, -6.5], [4.5, -4], [-2.2, -8.5], [2.2, -8.5], [0, -3]];
  return (
    <Harvestable delay={phase === "ripe" ? harvestDelay : undefined}>
      {phase === "ripe" && [[-4, 1.5], [0.5, 2], [4.5, 1.4]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="2.3" ry="1.7" fill="#b98a56" stroke="#8a6239" strokeWidth=".4" />)}
      {spots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.1" fill={i % 2 || cond !== "ok" || phase === "ripe" ? leaf : "#4c9a47"} />)}
      {phase === "bloom" && cond !== "hurt" && [[-2, -11.5], [1, -12.5], [3.5, -10.5]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="1.3" fill="#f3eefb" /><circle cx={x} cy={y} r=".45" fill="#f2c230" /></g>)}
    </Harvestable>
  );
}

/** Fraction (%) of the 7s drive when the sprayer boom's middle (26 units behind the tractor) reaches the first row (x≈96). */
const SPRAY_ON = Math.round(((96 + 26 - -80) / (340 - -80)) * 100);

/** The harvester makes one pass left → right; a plant is harvested when the machine's front reaches it. */
const HARVEST_FROM = -80;
const HARVEST_TO = 340;
const HARVEST_S = 6;
const harvestAt = (x: number, combine: boolean) => Math.max(0, ((x - (combine ? 66 : 40) - HARVEST_FROM) / (HARVEST_TO - HARVEST_FROM)) * HARVEST_S);

/** Centre of the i-th icon in the crop and investing rows; spaced so labels never touch. */
const ICON_X = (i: number) => 130 + i * 56;
const ICON_Y = 44;

/** Where the coins leave David's money bag (scene coordinates): the bag's mouth. */
const BAG = { x: 46 + 22 * 1.55, y: 176 - 42 * 1.55 };
/** A smooth arc from the bag's mouth up and to the right, ending at the bottom of the i-th item. */
const coinPath = (i: number) => {
  const tx = ICON_X(i);
  const ty = ICON_Y + 16;
  return `M${BAG.x} ${BAG.y} C${BAG.x + 8} ${BAG.y - 40} ${tx - 18} ${ty + 30} ${tx} ${ty}`;
};

const ROWS = [
  { y: 117, s: 0.78 },
  { y: 128, s: 0.88 },
  { y: 140, s: 0.98 },
  { y: 153, s: 1.08 },
  { y: 167, s: 1.18 },
];
const SPACING: Record<CropKey, number> = { blueberry: 25, potato: 17, wheat: 8, canola: 11 };
const PLANT_SCALE: Record<CropKey, number> = { blueberry: 1.2, potato: 1.05, wheat: 1, canola: 1 };

/* ------------------------------------------------------------------ */
/* The illustrated farm (SVG, 320×180)                                */
/* ------------------------------------------------------------------ */
export function Scene({ crop, stepKey, weather, tech, share, sell, profit, reduced }: { crop: CropKey; stepKey: StepKey; weather: WeatherKey; tech: Set<TechKey>; share: number; sell: SellKey; profit: number; reduced: boolean }) {
  const anim = !reduced;
  const si = idx(stepKey);
  const showWeather = si >= idx("weather") && si <= idx("result");
  const sky = showWeather ? WEATHER[weather].sky : (["#9bd8ff", "#eef8ff"] as [string, string]);
  const dry = showWeather && weather === "drought" && !tech.has("irrigation");
  const hurt = showWeather && (weather === "hail" || share < 0.7);
  const cond: Cond = hurt ? "hurt" : dry ? "dry" : "ok";
  const phase: Phase = si <= idx("grow") ? "young" : stepKey === "weather" ? "bloom" : stepKey === "harvest" ? "ripe" : "done";
  const perennial = !!CROPS[crop].perennial;
  const growScale = stepKey === "crop" ? (perennial ? 0.7 : 0) : stepKey === "invest" ? (perennial ? 0.85 : 0.55) : 1;
  const growClass = !anim ? "" : stepKey === "invest" ? (perennial ? "fj-leafout" : "fj-sprout") : stepKey === "grow" ? (perennial ? "fj-leafgrow" : "fj-grow") : "";
  const pose: Pose = stepKey === "invest" ? "invest" : stepKey === "harvest" ? "pick" : stepKey === "result" ? (profit >= 0 ? "cheer" : "worried") : stepKey === "hub" ? "cheer" : stepKey === "weather" && share < 0.7 ? "worried" : "idle";
  const mood: Mood = pose === "worried" ? "sad" : "happy";
  const berries = Math.max(1, Math.round(share * 5));
  const grain = crop === "wheat" || crop === "canola";
  const field =
    crop === "wheat" ? (phase === "ripe" || phase === "done" ? (cond === "hurt" ? "#b9a161" : "#d4b45c") : dry ? "#c9b37a" : "#86b964")
    : crop === "canola" ? (phase === "bloom" && cond !== "hurt" ? "#d6cf45" : dry ? "#c9b37a" : phase === "ripe" || phase === "done" ? "#a9a85a" : "#7fb36a")
    : dry ? "#c9b37a" : "#7fb36a";
  const signX = (i: number) => 60 + i * 74;
  const chosen = SELL_KEYS.indexOf(sell);
  const C = CROPS[crop];
  const showPlants = (stepKey !== "crop" || perennial) && stepKey !== "sell";

  return (
    <svg viewBox="0 0 320 180" className="block h-auto w-full" role="img" aria-label={`Illustration: ${C.label}, ${STEPS[si]!.title}`} style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <defs>
        <linearGradient id="fj-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky[0]} />
          <stop offset="100%" stopColor={sky[1]} />
        </linearGradient>
        <BushDef id="fj-bush-ok" dark="#2a6b33" mid="#3d8a45" light="#5aa85c" />
        <BushDef id="fj-bush-dry" dark="#7c7a3a" mid="#9a9548" light="#b8ad5c" />
        <BushDef id="fj-bush-hurt" dark="#55663a" mid="#6e8048" light="#88985a" sparse />
      </defs>
      <rect width="320" height="180" fill="url(#fj-sky)" />
      <path d="M0 98 Q60 76 120 94 T240 90 T320 96 V180 H0Z" fill="#9cc58f" />
      <path d="M0 106 Q80 94 160 104 T320 102 V180 H0Z" fill="#7fb36a" />
      {/* the crop field itself */}
      <path d="M88 110 L320 104 V180 H88Z" fill={stepKey === "crop" && !perennial ? "#8a6a42" : field} className="transition-colors duration-700" />

      {/* sun or storm */}
      {stepKey !== "sell" && stepKey !== "invest" && stepKey !== "crop" && (!showWeather || weather === "great" || weather === "drought") && (
        <g className={anim ? "fj-spin" : ""} style={{ transformOrigin: "290px 26px" }}>
          <circle cx="290" cy="26" r={weather === "drought" && showWeather ? 14 : 11} fill={weather === "drought" && showWeather ? "#ff8a1f" : "#ffd23f"} />
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i} x1="290" y1="8" x2="290" y2="3" stroke="#ffd23f" strokeWidth="2" strokeLinecap="round" transform={`rotate(${i * 45} 290 26)`} />
          ))}
        </g>
      )}
      {showWeather && (weather === "hail" || weather === "rain") && (
        <g>
          {[60, 150, 240].map((x, i) => (
            <g key={x} className={anim ? "fj-drift" : ""} style={{ animationDelay: `${i * 0.7}s` }}>
              <ellipse cx={x} cy="24" rx="36" ry="12" fill={weather === "hail" ? "#d5dbe1" : "#e9eef2"} />
              <ellipse cx={x + 18} cy="18" rx="20" ry="10" fill={weather === "hail" ? "#e3e8ec" : "#f4f7f9"} />
            </g>
          ))}
          {Array.from({ length: weather === "hail" ? 40 : 30 }, (_, i) => {
            const x = 8 + ((i * 37) % 306);
            const style = { animationDelay: `${(i % 7) * 0.15}s` };
            return weather === "rain" ? (
              <line key={i} x1={x} y1="36" x2={x - 3} y2="44" stroke="#4a90c2" strokeWidth="1.2" className={anim ? "fj-fall" : ""} style={style} />
            ) : (
              <circle key={i} cx={x} cy="38" r={1.6 + (i % 3) * 0.5} fill="#fff" stroke="#9fb3c4" strokeWidth=".4" className={anim ? "fj-fall" : ""} style={style} />
            );
          })}
        </g>
      )}
      {showWeather && weather === "drought" && anim && (
        <g opacity=".55">
          {[140, 200, 260].map((x, i) => (
            <path key={x} d={`M${x} 104 q4 -6 0 -12 q-4 -6 0 -12`} stroke="#fff3d6" strokeWidth="1.5" fill="none" className="fj-heat" style={{ animationDelay: `${i * 0.5}s` }} />
          ))}
        </g>
      )}

      {/* rows: mulched beds for blueberries, hills for potatoes, furrows for grain */}
      {ROWS.map((row) => (
        <g key={row.y}>
          {crop === "blueberry" && (
            <>
              <rect x="92" y={row.y - 1.5 * row.s} width="226" height={5 * row.s} rx={2.5 * row.s} fill={dry ? "#b9955f" : "#a9824f"} />
              <rect x="92" y={row.y - 1.5 * row.s} width="226" height={1.6 * row.s} rx={0.8 * row.s} fill="#c9a26b" opacity=".7" />
            </>
          )}
          {crop === "potato" && <rect x="92" y={row.y - 2.5 * row.s} width="226" height={6 * row.s} rx={3 * row.s} fill={dry ? "#9a7650" : "#7a5532"} />}
          {grain && <line x1="92" y1={row.y + 1} x2="318" y2={row.y + 1} stroke="#5d4426" strokeWidth={0.8 * row.s} opacity=".35" />}
          {tech.has("irrigation") && stepKey !== "crop" && <line x1="92" y1={row.y + 1.2 * row.s} x2="318" y2={row.y + 1.2 * row.s} stroke="#1d4f86" strokeWidth={0.9 * row.s} strokeDasharray={grain ? "3 4" : undefined} />}
        </g>
      ))}
      {showPlants &&
        ROWS.map((row, r) =>
          Array.from({ length: Math.floor(212 / (SPACING[crop] * row.s)) }, (_, c) => {
            const x = 104 + c * SPACING[crop] * row.s + (r % 2) * (SPACING[crop] / 3) * row.s;
            return (
              <g key={`${r}-${c}`} transform={`translate(${x} ${row.y + 1}) scale(${row.s * PLANT_SCALE[crop]})`}>
                <g className={growClass} style={{ transform: `scale(${growScale})`, transformBox: "fill-box", transformOrigin: "50% 100%", animationDelay: growClass ? `${((c % 9) + r) * 0.1}s` : undefined }}>
                  <Plant crop={crop} phase={phase} cond={cond} n={berries} harvestDelay={stepKey === "harvest" && anim ? harvestAt(x, grain) : undefined} />
                </g>
              </g>
            );
          }),
        )}
      {tech.has("protection") && showPlants && crop === "blueberry" && (
        <g opacity=".55">
          <line x1="94" y1="104" x2="316" y2="104" stroke="#fff" strokeWidth="1" />
          {Array.from({ length: 23 }, (_, i) => <line key={i} x1={94 + i * 10} y1="104" x2={94 + i * 10} y2="172" stroke="#fff" strokeWidth=".4" />)}
          {[118, 132, 146, 160].map((y) => <line key={y} x1="94" y1={y} x2="316" y2={y} stroke="#fff" strokeWidth=".4" />)}
        </g>
      )}
      {tech.has("sensors") && showPlants && (
        <g transform="translate(306 96)">
          <line x1="0" y1="0" x2="0" y2="16" stroke="#334" strokeWidth="1.4" />
          <rect x="-3" y="-4" width="6" height="5" rx="1" fill="#fff" stroke="#334" strokeWidth=".6" />
          {anim && [5, 9].map((r) => <path key={r} d={`M${-r} -6 q${r} -${r} ${2 * r} 0`} stroke="#2d8ad8" strokeWidth=".8" fill="none" className="fj-ping" />)}
        </g>
      )}

      {/* PICK A CROP — four crop signs, the chosen one pulses */}
      {stepKey === "crop" &&
        CROP_KEYS.map((k, i) => {
          const x = ICON_X(i);
          const on = k === crop;
          return (
            <g key={k} className={on && anim ? "fj-pulse" : ""} style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}>
              <circle cx={x} cy={ICON_Y} r="18" fill={on ? "#f6eccf" : "#fff"} stroke={on ? "#bc8a2e" : "#c9c3ad"} strokeWidth={on ? 2.4 : 1} />
              <text x={x} y={ICON_Y + 6.5} textAnchor="middle" fontSize="18">{CROPS[k].emoji}</text>
              <text x={x} y={ICON_Y + 31} textAnchor="middle" fontSize="10" fontWeight="800" fill="#0c3520">{CROPS[k].short}</text>
            </g>
          );
        })}

      {/* INVEST — coins fly from David's money bag to each input */}
      {stepKey === "invest" &&
        [
          [C.seedEmoji, C.seedLabel.split(" ")[0]!],
          ["🧪", "Fertilizer"],
          ["tractor", "Machinery"],
          [tech.size ? "📡" : "🚫", tech.size ? "Tech" : "No tech"],
        ].map(([e, label], i) => {
          const x = ICON_X(i);
          return (
            <g key={label}>
              <circle cx={x} cy={ICON_Y} r="15" fill="#fff" stroke={label === "No tech" ? "#c9c3ad" : "#bc8a2e"} strokeWidth="1.2" />
              {e === "tractor" ? (
                <g transform={`translate(${x - 9} ${ICON_Y + 8}) scale(.45)`}>
                  <Tractor anim={false} />
                </g>
              ) : (
                <text x={x} y={ICON_Y + 5.5} textAnchor="middle" fontSize="15">{e}</text>
              )}
              <text x={x} y={ICON_Y - 20} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#0c3520">{label}</text>
            </g>
          );
        })}

      {/* GROW — the tractor drives forward along the rows */}
      {stepKey === "grow" && (
        <g className={anim ? "fj-drive" : ""} style={anim ? undefined : { transform: "translateX(150px)" }}>
          <g transform="translate(0 124)">
            <Tractor spray anim={anim} />
          </g>
        </g>
      )}

      {/* HARVEST — combine for grain, tractor and trailer for berries and potatoes */}
      {stepKey === "harvest" && (
        <g className={anim ? "fj-harvest" : ""} style={anim ? undefined : { transform: "translateX(170px)" }}>
          <g transform="translate(0 112)">{grain ? <Combine crop={crop} anim={anim} /> : <Tractor load={Math.max(1, Math.round(share * 6))} crop={crop} anim={anim} />}</g>
        </g>
      )}

      {/* SELL — four places to sell, least to most profitable; the truck drives to David's choice */}
      {stepKey === "sell" && (
        <g>
          <rect x="0" y="152" width="320" height="16" fill="#8b8b8b" />
          {Array.from({ length: 16 }, (_, i) => <rect key={i} x={i * 20 + 4} y="159" width="10" height="2" fill="#fff" />)}
          {SELL_KEYS.map((k, i) => {
            const s = C.sell[k];
            const x = signX(i);
            const on = i === chosen;
            const words = s.label.split(" ");
            return (
              <g key={k} className={on && anim ? "fj-pulse" : ""} style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}>
                <line x1={x} y1="68" x2={x} y2="152" stroke="#6b4f2a" strokeWidth="2" />
                <rect x={x - 32} y="5" width="64" height="63" rx="8" fill={on ? "#f6eccf" : "#fff"} stroke={on ? "#bc8a2e" : "#c9c3ad"} strokeWidth={on ? 2.2 : 1} />
                <text x={x} y="25" textAnchor="middle" fontSize="17">{s.emoji}</text>
                <text x={x} y="41" textAnchor="middle" fontSize="12" fontWeight="900" fill="#bc8a2e">{"$".repeat(DOLLARS[k])}</text>
                <text x={x} y="53" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#0c3520">{words[0]}</text>
                <text x={x} y="63" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#0c3520">{words.slice(1).join(" ")}</text>
              </g>
            );
          })}
          <g key={sell} className={anim ? "fj-truck" : ""} style={{ ["--tx" as string]: `${signX(chosen) - 56}px`, ...(anim ? {} : { transform: `translateX(${signX(chosen) - 56}px)` }) } as CSSProperties}>
            <g transform="translate(0 158)">
              <Truck anim={anim} />
            </g>
          </g>
        </g>
      )}

      {/* RESULT */}
      {stepKey === "result" && (
        <g transform="translate(200 58)">
          <g className={anim ? "fj-popin" : ""} style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}>
            <rect x="-58" y="-26" width="116" height="48" rx="12" fill={profit >= 0 ? "#1e7a3c" : "#c8103e"} opacity=".94" />
            <text y="-6" textAnchor="middle" fontSize="16">{profit >= 0 ? "💰💰" : "📉"}</text>
            <text y="14" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff">{money(profit)}</text>
          </g>
        </g>
      )}

      {/* HUB — AGRI HUB connects everyone around David */}
      {stepKey === "hub" && (
        <g>
          <circle cx="200" cy="62" r="21" fill="#0c3520" />
          <text x="200" y="60" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fff">AGRI</text>
          <text x="200" y="71" textAnchor="middle" fontSize="9" fontWeight="900" fill="#ead9a8">HUB</text>
          {[
            ["🏦", 120, 36],
            ["🧪", 130, 92],
            ["🎓", 280, 36],
            ["🛒", 272, 94],
            ["🚢", 200, 14],
          ].map(([e, x, y]) => (
            <g key={String(e)}>
              <line x1="200" y1="62" x2={x as number} y2={y as number} stroke="#bc8a2e" strokeWidth="1.2" strokeDasharray="3 2" className={anim ? "fj-dash" : ""} />
              <circle cx={x as number} cy={y as number} r="11" fill="#fff" stroke="#bc8a2e" />
              <text x={x as number} y={(y as number) + 4.5} textAnchor="middle" fontSize="12">{e}</text>
            </g>
          ))}
        </g>
      )}

      {/* David, the hero, always in the foreground */}
      <Farmer x={46} y={176} s={1.55} pose={pose} mood={mood} crop={crop} anim={anim} />

      {/* INVEST — money flows out of the bag David holds: dashed trails show the direction, $ coins glide along each one */}
      {stepKey === "invest" &&
        [0, 1, 2, 3].filter((i) => i < 3 || tech.size > 0).map((i) => {
          const d = coinPath(i);
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="#bc8a2e" strokeWidth="1.1" strokeDasharray="3 3" opacity=".7" className={anim ? "fj-dash" : ""} />
              {anim &&
                [0, 1].map((k) => {
                  const begin = `${(i * 0.35 + k * 0.9).toFixed(2)}s`;
                  return (
                    <g key={k} opacity="0">
                      <animateMotion dur="1.8s" begin={begin} repeatCount="indefinite" path={d} />
                      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.8;1" dur="1.8s" begin={begin} repeatCount="indefinite" />
                      <circle r="4.6" fill="#ffd23f" stroke="#bc8a2e" strokeWidth=".9" />
                      <text y="2.6" textAnchor="middle" fontSize="7" fontWeight="900" fill="#8a5a1f">$</text>
                    </g>
                  );
                })}
            </g>
          );
        })}
    </svg>
  );
}

const CSS = `
@keyframes fj-fill { from { width: 0 } to { width: 100% } }
.fj-fill { animation: fj-fill ${STEP_MS}ms linear forwards; }
.fj-fill-long { animation: fj-fill ${DECIDE_MS}ms linear forwards; }
@keyframes fj-countdown { from { width: 100% } to { width: 0 } }
.fj-countdown { animation: fj-countdown ${DECIDE_MS}ms linear forwards; }
@keyframes fj-wiggle { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-12deg) } 75% { transform: rotate(12deg) } }
.fj-wiggle { animation: fj-wiggle 1s ease-in-out infinite; }
@keyframes fj-type { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
.fj-type { display: inline; animation: fj-type .5s ease-out both; }
@keyframes fj-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-1.5px) } }
.fj-bob { animation: fj-bob 1.6s ease-in-out infinite; }
@keyframes fj-spin { to { transform: rotate(360deg) } }
.fj-spin { animation: fj-spin 18s linear infinite; }
.fj-wheel { animation: fj-spin .9s linear infinite; transform-box: fill-box; transform-origin: center; }
@keyframes fj-drift { 0%,100% { transform: translateX(0) } 50% { transform: translateX(10px) } }
.fj-drift { animation: fj-drift 6s ease-in-out infinite; }
@keyframes fj-fall { from { transform: translateY(0); opacity: 1 } to { transform: translateY(74px); opacity: 0 } }
.fj-fall { animation: fj-fall 1s linear infinite; }
@keyframes fj-heat { 0%,100% { transform: translateY(0); opacity: .2 } 50% { transform: translateY(-6px); opacity: .8 } }
.fj-heat { animation: fj-heat 2.2s ease-in-out infinite; }
@keyframes fj-shake { 0%,100% { transform: translate(22px,-36px) rotate(0) } 25% { transform: translate(22px,-36px) rotate(-8deg) } 75% { transform: translate(22px,-36px) rotate(8deg) } }
.fj-shake { animation: fj-shake .6s ease-in-out infinite; }
@keyframes fj-spray { from { transform: translateY(0); opacity: .9 } to { transform: translateY(11px); opacity: 0 } }
.fj-spray { animation: fj-spray .8s linear infinite; }
/* the sprayer runs only while its boom is over the crop rows (synced with the 7s drive) */
@keyframes fj-sprayon { 0%, ${SPRAY_ON}% { opacity: 0 } ${SPRAY_ON + 2}%, 100% { opacity: 1 } }
.fj-sprayon { animation: fj-sprayon 7s linear infinite; }
@keyframes fj-sprout { from { transform: scale(.08) } to { transform: scale(.55) } }
.fj-sprout { animation: fj-sprout 5.5s ease-out both; }
@keyframes fj-leafout { from { transform: scale(.7); filter: saturate(.3) brightness(.9) } to { transform: scale(.85); filter: none } }
.fj-leafout { animation: fj-leafout 5s ease-out both; }
@keyframes fj-leafgrow { from { transform: scale(.85) } to { transform: scale(1) } }
.fj-leafgrow { animation: fj-leafgrow 3s ease-out both; }
@keyframes fj-grow { from { transform: scale(.55) } to { transform: scale(1) } }
.fj-grow { animation: fj-grow 3.5s ease-out both; }
@keyframes fj-drive { from { transform: translateX(${HARVEST_FROM}px) } to { transform: translateX(${HARVEST_TO}px) } }
.fj-drive { animation: fj-drive 7s linear infinite; }
.fj-harvest { animation: fj-drive ${HARVEST_S}s linear both; }
@keyframes fj-gone { 0% { opacity: 1; transform: translateY(0) } 100% { opacity: 0; transform: translateY(-3px) } }
.fj-gone { animation: fj-gone .5s ease-in forwards; }
@keyframes fj-smoke { from { transform: translate(0,0); opacity: .8 } to { transform: translate(-4px,-10px) scale(2); opacity: 0 } }
.fj-smoke { animation: fj-smoke 1.2s ease-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes fj-truck { from { transform: translateX(-70px) } to { transform: translateX(var(--tx)) } }
.fj-truck { animation: fj-truck 2.8s cubic-bezier(.3,.7,.4,1) forwards; }
@keyframes fj-pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.07) } }
.fj-pulse { animation: fj-pulse 1.4s ease-in-out infinite; }
@keyframes fj-popin { 0% { transform: scale(0) } 70% { transform: scale(1.12) } 100% { transform: scale(1) } }
.fj-popin { animation: fj-popin .55s ease-out both; }
@keyframes fj-ping { 0%,100% { opacity: .2 } 50% { opacity: 1 } }
.fj-ping { animation: fj-ping 1.4s ease-in-out infinite; }
@keyframes fj-dash { to { stroke-dashoffset: -20 } }
.fj-dash { animation: fj-dash 1s linear infinite; }
@media (prefers-reduced-motion: reduce) { [class^="fj-"], [class*=" fj-"] { animation: none !important; } }
`;
