import { formatDate } from "@/lib/utils";

type Series = { name: string; color: string; points: { label: Date | string; value: number }[] };

/** Lightweight accessible SVG line chart (no client JS). */
export function LineChart({ series, height = 220, ariaLabel }: { series: Series[]; height?: number; ariaLabel: string }) {
  const W = 640;
  const H = height;
  const pad = { l: 34, r: 12, t: 14, b: 28 };
  const n = series[0]?.points.length ?? 0;
  const max = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.value)));
  const niceMax = Math.ceil(max / 5) * 5 || 5;
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, n - 1);
  const y = (v: number) => H - pad.b - (v / niceMax) * (H - pad.t - pad.b);
  const ticks = [0, niceMax / 2, niceMax];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e2decd" strokeDasharray={t === 0 ? undefined : "4 4"} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#4c5b50">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {series[0]?.points.map((p, i) =>
          i % Math.ceil(n / 6) === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#4c5b50">
              {typeof p.label === "string" ? p.label : formatDate(p.label, { month: "short", day: "numeric" })}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          const d = s.points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
          const area = `${d} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)} Z`;
          return (
            <g key={s.name}>
              <path d={area} fill={s.color} opacity={0.08} />
              <path d={d} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p, i) => (
                <circle key={i} cx={x(i)} cy={y(p.value)} r={3} fill="#fff" stroke={s.color} strokeWidth={2}>
                  <title>{`${s.name}: ${p.value}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full" style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Horizontal bars with labels — readable on phones. */
export function BarList({ rows, color = "#0c3520", unit = "" }: { rows: { label: string; value: number }[]; color?: string; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium">{r.label}</span>
            <span className="text-muted tabular-nums">
              {r.value.toLocaleString("en-CA", { maximumFractionDigits: 2 })}
              {unit}
            </span>
          </div>
          <div className="h-2 rounded-full bg-sand">
            <div className="h-2 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
