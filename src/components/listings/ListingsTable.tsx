"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pause, Pencil, Play, PackageCheck, Archive } from "lucide-react";
import { Pill } from "@/components/ui";
import { api, ClientApiError } from "@/lib/client";
import { asset } from "@/lib/paths";

type Row = { id: string; slug: string; title: string; photo: string | null; volume: string; status: string; approval: string; inquiries: number; rfqs: number };

const STATUS_TONE: Record<string, "green" | "gold" | "neutral" | "red"> = { active: "green", paused: "gold", draft: "neutral", sold_out: "red", archived: "neutral" };

export function ListingsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function act(id: string, payload: { status: string } | "archive") {
    setBusy(id);
    setError(null);
    try {
      if (payload === "archive") await api(`/listings/${id}`, { method: "DELETE" });
      else await api(`/listings/${id}`, { method: "PATCH", body: payload });
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }
  if (!rows.length) return <p className="px-6 pb-6 text-sm text-muted">No listings yet.</p>;
  const btn = "grid size-9 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink disabled:opacity-40";
  return (
    <div className="overflow-x-auto">
      {error && <p className="px-6 text-sm text-danger" role="alert">{error}</p>}
      <table className="w-full min-w-[640px] text-left text-[15px]">
        <thead className="border-y border-line bg-cream text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="px-6 py-3 font-semibold">Produce</th>
            <th className="px-3 py-3 font-semibold">Volume</th>
            <th className="px-3 py-3 font-semibold">Status</th>
            <th className="px-3 py-3 font-semibold">Inquiries</th>
            <th className="px-6 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id} className={busy === r.id ? "opacity-50" : undefined}>
              <td className="px-6 py-3">
                <Link href={`/marketplace/${r.slug}`} className="flex items-center gap-3 font-semibold hover:text-leaf">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset(r.photo ?? "/seed/greens-1.svg")} alt="" className="size-10 rounded-lg object-cover" />
                  <span className="line-clamp-2">{r.title}</span>
                </Link>
              </td>
              <td className="px-3 py-3 whitespace-nowrap">{r.volume}</td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-1">
                  <Pill tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</Pill>
                  {r.approval !== "approved" && <Pill tone={r.approval === "rejected" ? "red" : "neutral"}>{r.approval === "pending" ? "in review" : r.approval}</Pill>}
                </div>
              </td>
              <td className="px-3 py-3 whitespace-nowrap">
                {r.inquiries} <span className="text-xs text-muted">({r.rfqs} RFQ)</span>
              </td>
              <td className="px-6 py-3">
                <div className="flex justify-end gap-1">
                  <Link href={`/dashboard/listings/${r.id}/edit`} className={btn} aria-label={`Edit ${r.title}`} title="Edit">
                    <Pencil className="size-4" />
                  </Link>
                  {r.status === "active" ? (
                    <button className={btn} disabled={!!busy} onClick={() => act(r.id, { status: "paused" })} aria-label={`Pause ${r.title}`} title="Pause">
                      <Pause className="size-4" />
                    </button>
                  ) : (
                    <button className={btn} disabled={!!busy} onClick={() => act(r.id, { status: "active" })} aria-label={`Publish ${r.title}`} title="Publish / resume">
                      <Play className="size-4" />
                    </button>
                  )}
                  {r.status !== "sold_out" && (
                    <button className={btn} disabled={!!busy} onClick={() => act(r.id, { status: "sold_out" })} aria-label={`Mark ${r.title} sold out`} title="Mark sold out">
                      <PackageCheck className="size-4" />
                    </button>
                  )}
                  <button className={btn} disabled={!!busy} onClick={() => confirm("Archive this listing? It will disappear from the marketplace.") && act(r.id, "archive")} aria-label={`Archive ${r.title}`} title="Archive">
                    <Archive className="size-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
