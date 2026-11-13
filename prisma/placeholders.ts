// Generates branded SVG placeholder art for seed data into public/seed/.
// Clearly marked "Sample photo" so nobody mistakes them for real farm photos.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve("public/seed");

type Art = { bg: [string, string]; draw: (rnd: () => number) => string };

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const circleCluster = (rnd: () => number, n: number, r: [number, number], fill: string[], extra = "") => {
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = 90 + rnd() * 620;
    const y = 170 + rnd() * 330;
    const rr = r[0] + rnd() * (r[1] - r[0]);
    const f = fill[Math.floor(rnd() * fill.length)];
    out += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rr.toFixed(0)}" fill="${f}"/>`;
    out += `<circle cx="${(x - rr * 0.35).toFixed(0)}" cy="${(y - rr * 0.35).toFixed(0)}" r="${(rr * 0.22).toFixed(0)}" fill="#fff" opacity=".28"/>`;
    if (extra) out += extra.replaceAll("{x}", x.toFixed(0)).replaceAll("{y}", (y - rr * 0.8).toFixed(0));
  }
  return out;
};

const ARTS: Record<string, Art> = {
  blueberries: { bg: ["#dfe7f4", "#b8c8e6"], draw: (r) => circleCluster(r, 34, [26, 40], ["#2d3f7c", "#3a4f94", "#25346a", "#4a5fa8"], `<path d="M{x} {y} l-6 -6 m6 6 l6 -6" stroke="#1b2550" stroke-width="3"/>`) },
  raspberries: { bg: ["#f8e1e3", "#efb7bd"], draw: (r) => { let o = ""; for (let i = 0; i < 16; i++) { const x = 110 + r() * 580, y = 190 + r() * 300; o += `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})">`; for (let k = 0; k < 9; k++) o += `<circle cx="${((k % 3) - 1) * 16}" cy="${(Math.floor(k / 3) - 1) * 16}" r="13" fill="${["#c0233a", "#d33a4f", "#a91d32"][k % 3]}"/>`; o += `<path d="M-14 -30 q14 -14 28 0" fill="#3f7d2c"/></g>`; } return o; } },
  strawberries: { bg: ["#fde4e1", "#f6b7ae"], draw: (r) => { let o = ""; for (let i = 0; i < 14; i++) { const x = 110 + r() * 580, y = 200 + r() * 290; o += `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${(r() * 50 - 25).toFixed(0)})"><path d="M0 50 C-45 10 -40 -30 0 -28 C40 -30 45 10 0 50Z" fill="#d9302a"/><path d="M-22 -30 l10 8 l12 -12 l12 12 l10 -8 l-6 14 h-32z" fill="#3f8a2e"/></g>`; } return o; } },
  tomatoes: { bg: ["#fbe3d9", "#f2b39b"], draw: (r) => circleCluster(r, 16, [44, 62], ["#d6362b", "#e2452f", "#c42d22"], `<path d="M{x} {y} l-14 -2 l10 -8 l4 -12 l4 12 l10 8z" fill="#2f7a26"/>`) },
  peppers: { bg: ["#f4f0d8", "#e3d79b"], draw: (r) => { let o = ""; const c = ["#d4302a", "#f2b315", "#2f8a2b", "#e8761c"]; for (let i = 0; i < 12; i++) { const x = 110 + r() * 580, y = 210 + r() * 270; o += `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${(r() * 70 - 35).toFixed(0)})"><path d="M-34 -20 C-40 40 -10 70 0 70 C10 70 40 40 34 -20 C20 -36 -20 -36 -34 -20Z" fill="${c[i % 4]}"/><rect x="-5" y="-48" width="10" height="20" rx="4" fill="#3a6b21"/></g>`; } return o; } },
  cucumbers: { bg: ["#e2f0dc", "#b9d9a8"], draw: (r) => { let o = ""; for (let i = 0; i < 12; i++) { const x = 120 + r() * 560, y = 200 + r() * 280; o += `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${(r() * 140 - 70).toFixed(0)})"><rect x="-90" y="-22" width="180" height="44" rx="22" fill="${i % 2 ? "#2f6b22" : "#3c7d2b"}"/>${Array.from({ length: 6 }, (_, k) => `<circle cx="${-60 + k * 24}" cy="${k % 2 ? -6 : 7}" r="3" fill="#a8cf8a"/>`).join("")}</g>`; } return o; } },
  apples: { bg: ["#f6e4da", "#e9b9a0"], draw: (r) => circleCluster(r, 14, [48, 60], ["#c2272d", "#d8462b", "#9e1f27", "#e3a92a"], `<path d="M{x} {y} q4 -18 12 -22" stroke="#5a3b1c" stroke-width="5" fill="none"/>`) },
  cherries: { bg: ["#f6dfe3", "#e6a9b5"], draw: (r) => { let o = ""; for (let i = 0; i < 14; i++) { const x = 110 + r() * 580, y = 230 + r() * 260; o += `<path d="M${x - 20} ${y} Q${x} ${y - 90} ${x + 30} ${y - 100} M${x + 22} ${y + 6} Q${x + 30} ${y - 60} ${x + 30} ${y - 100}" stroke="#4d6b1f" stroke-width="4" fill="none"/><circle cx="${x - 20}" cy="${y}" r="24" fill="#8e1022"/><circle cx="${x + 22}" cy="${y + 6}" r="24" fill="#a0142a"/>`; } return o; } },
  greens: { bg: ["#e5f2de", "#bfe0ad"], draw: (r) => { let o = ""; for (let i = 0; i < 22; i++) { const x = 100 + r() * 600, y = 190 + r() * 310; o += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(40 + r() * 30).toFixed(0)}" ry="${(24 + r() * 16).toFixed(0)}" transform="rotate(${(r() * 180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})" fill="${["#4f9a37", "#6bb34a", "#3d7f2a", "#86c25f"][i % 4]}"/>`; } return o; } },
  herbs: { bg: ["#e9f3e4", "#c5e2b8"], draw: (r) => { let o = ""; for (let i = 0; i < 9; i++) { const x = 120 + r() * 560, y = 470; o += `<path d="M${x} ${y} q${(r() * 40 - 20).toFixed(0)} -150 0 -260" stroke="#3d6b25" stroke-width="5" fill="none"/>`; for (let k = 0; k < 5; k++) { const yy = y - 40 - k * 45; o += `<ellipse cx="${x - 22}" cy="${yy}" rx="24" ry="12" fill="#4e9a3a" transform="rotate(-30 ${x - 22} ${yy})"/><ellipse cx="${x + 22}" cy="${yy - 10}" rx="24" ry="12" fill="#5fae47" transform="rotate(30 ${x + 22} ${yy - 10})"/>`; } } return o; } },
  potatoes: { bg: ["#f1e7d6", "#dcc6a0"], draw: (r) => { let o = ""; for (let i = 0; i < 14; i++) { const x = 110 + r() * 580, y = 200 + r() * 290; o += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(50 + r() * 16).toFixed(0)}" ry="${(34 + r() * 10).toFixed(0)}" fill="${["#b98a52", "#a87a45", "#c99a62"][i % 3]}" transform="rotate(${(r() * 60 - 30).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/><circle cx="${(x + 10).toFixed(0)}" cy="${(y - 6).toFixed(0)}" r="3" fill="#7a5a2f"/>`; } return o; } },
  eggs: { bg: ["#f6efe2", "#e8d6b5"], draw: (r) => { let o = `<rect x="110" y="260" width="580" height="220" rx="18" fill="#c9b08a"/>`; for (let i = 0; i < 12; i++) { const x = 160 + (i % 6) * 96, y = 320 + Math.floor(i / 6) * 96; o += `<ellipse cx="${x}" cy="${y}" rx="34" ry="44" fill="${r() > 0.5 ? "#f4ead8" : "#d9a978"}"/>`; } return o; } },
  dairy: { bg: ["#e6eef6", "#c3d5e8"], draw: () => `<g fill="#fff" stroke="#9fb6cf" stroke-width="4"><path d="M250 200 h90 v40 l30 40 v220 h-150 v-220 l30 -40z"/><path d="M430 230 h90 v30 l30 40 v200 h-150 v-200 l30 -40z"/></g><rect x="225" y="330" width="150" height="70" fill="#0B5A14"/><rect x="405" y="350" width="150" height="60" fill="#C99A2E"/>` },
  honey: { bg: ["#fbefd2", "#f1d48e"], draw: () => `<rect x="300" y="210" width="200" height="260" rx="30" fill="#e0a21a" stroke="#a8740c" stroke-width="6"/><rect x="290" y="180" width="220" height="44" rx="10" fill="#7a5a12"/><rect x="330" y="300" width="140" height="80" rx="8" fill="#fff8e6"/>` },
  nursery: { bg: ["#e6f1e0", "#c1dfb0"], draw: (r) => { let o = ""; for (let i = 0; i < 5; i++) { const x = 140 + i * 130; o += `<path d="M${x - 42} 400 h84 l-12 90 h-60z" fill="#b5652d"/>`; for (let k = 0; k < 7; k++) o += `<circle cx="${(x + (r() * 80 - 40)).toFixed(0)}" cy="${(330 - r() * 90).toFixed(0)}" r="${(26 + r() * 14).toFixed(0)}" fill="${["#3f8a2e", "#5aa63f", "#2f6f22"][k % 3]}"/>`; } return o; } },
  grapes: { bg: ["#ece2f2", "#cdb6de"], draw: (r) => circleCluster(r, 40, [20, 28], ["#5b2a6e", "#6d3684", "#4a2159", "#7d4596"]) },
  corn: { bg: ["#fbf1d2", "#efd98a"], draw: (r) => { let o = ""; for (let i = 0; i < 7; i++) { const x = 140 + i * 90, y = 330 + r() * 40; o += `<g transform="rotate(${(r() * 30 - 15).toFixed(0)} ${x} ${y})"><path d="M${x - 40} ${y + 90} q-10 -120 40 -190 q50 70 40 190z" fill="#5c9a33"/><ellipse cx="${x}" cy="${y - 10}" rx="26" ry="80" fill="#f2c83a"/></g>`; } return o; } },
};

function produceSvg(kind: string, label: string, seed: number) {
  const art = ARTS[kind] ?? ARTS.greens!;
  const r = rng(seed);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${art.bg[0]}"/><stop offset="1" stop-color="${art.bg[1]}"/></linearGradient></defs>
<rect width="800" height="600" fill="url(#g)"/>
${Array.from({ length: 7 }, (_, i) => `<rect x="0" y="${520 + i * 12}" width="800" height="6" fill="#8a6a3d" opacity="${0.18 + i * 0.03}"/>`).join("")}
${art.draw(r)}
<rect x="24" y="24" rx="16" width="${Math.max(170, label.length * 14 + 40)}" height="42" fill="#1A2B1A" opacity=".82"/>
<text x="44" y="52" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#fff">${label}</text>
<text x="776" y="580" text-anchor="end" font-family="Arial, sans-serif" font-size="15" fill="#1A2B1A" opacity=".65">Sample photo · AGRI HUB</text>
</svg>`;
}

const ROLE_COLORS: Record<string, [string, string]> = {
  grower: ["#0B5A14", "#5C6B28"],
  buyer: ["#C99A2E", "#8a5a00"],
  university: ["#24557a", "#3b7bb0"],
  consultant: ["#9b2c22", "#c4523f"],
  edc: ["#2f6b55", "#4f9a7e"],
  fcc: ["#5b3f93", "#8065b8"],
  financing: ["#8a4f22", "#b5763f"],
  bc_gov: ["#1f3a5c", "#3a6290"],
  fed_gov: ["#7b5d1d", "#b08a36"],
  agtech: ["#13695a", "#25a08b"],
  sales_marketing: ["#33449a", "#5a6cc8"],
};

function avatarSvg(initials: string, role: string) {
  const [a, b] = ROLE_COLORS[role] ?? ROLE_COLORS.grower!;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="240" height="240" rx="48" fill="url(#g)"/>
<path d="M0 180 Q60 150 120 175 T240 165 V240 H0Z" fill="#fff" opacity=".12"/>
<path d="M0 205 Q70 180 130 200 T240 195 V240 H0Z" fill="#fff" opacity=".12"/>
<text x="120" y="138" text-anchor="middle" font-family="Georgia, serif" font-size="84" font-weight="700" fill="#fff">${initials}</text>
</svg>`;
}

function coverSvg(seed: number, tone: [string, string]) {
  const r = rng(seed);
  let rows = "";
  for (let i = 0; i < 14; i++) {
    const y = 210 + i * 22 + r() * 6;
    rows += `<path d="M0 ${y.toFixed(0)} Q600 ${(y - 40 - r() * 30).toFixed(0)} 1600 ${(y + 10).toFixed(0)}" stroke="${i % 2 ? tone[1] : "#fff"}" stroke-width="${(7 + i * 0.8).toFixed(1)}" opacity="${0.22 + (i % 3) * 0.08}" fill="none"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 500" width="1600" height="500" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3ead2"/><stop offset=".55" stop-color="#e6dcb8"/></linearGradient></defs>
<rect width="1600" height="500" fill="url(#sky)"/>
<path d="M0 260 L220 150 L380 230 L560 120 L760 240 L980 140 L1180 230 L1380 150 L1600 230 V500 H0Z" fill="#9fb3a0" opacity=".55"/>
<path d="M0 300 Q400 190 800 260 T1600 240 V500 H0Z" fill="${tone[0]}"/>
${rows}
<circle cx="${(1200 + r() * 250).toFixed(0)}" cy="90" r="46" fill="#C99A2E" opacity=".85"/>
</svg>`;
}

export function writePlaceholders(produce: { file: string; kind: string; label: string }[], avatars: { file: string; initials: string; role: string }[]) {
  mkdirSync(OUT, { recursive: true });
  produce.forEach((p, i) => writeFileSync(path.join(OUT, p.file), produceSvg(p.kind, p.label, 1000 + i * 37)));
  avatars.forEach((a) => writeFileSync(path.join(OUT, a.file), avatarSvg(a.initials, a.role)));
  const tones: [string, string][] = [
    ["#3f7d2c", "#C99A2E"],
    ["#5C6B28", "#e9d9a0"],
    ["#0B5A14", "#7fb069"],
    ["#2f6b55", "#d8c27a"],
  ];
  tones.forEach((t, i) => writeFileSync(path.join(OUT, `cover-${i + 1}.svg`), coverSvg(77 + i * 13, t)));
}
