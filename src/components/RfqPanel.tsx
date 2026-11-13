"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Pill } from "@/components/ui";
import { FormError } from "@/components/forms";
import { api, ClientApiError } from "@/lib/client";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";

type Rfq = { id: string; status: string; quantity: number; unit: string; deliveryDate: string | null; targetPrice: number | null; notes: string | null; quotePrice: number | null; quoteNotes: string | null };

const TONE = { open: "neutral", quoted: "gold", accepted: "green", declined: "red", withdrawn: "neutral" } as const;

/** Structured RFQ workflow: grower quotes/declines, buyer accepts/withdraws. */
export function RfqPanel({ rfq, role }: { rfq: Rfq; role: "grower" | "buyer" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (payload: object) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/rfqs/${rfq.id}`, { body: payload });
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };
  const live = rfq.status === "open" || rfq.status === "quoted";
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base">Request for quote</h2>
        <Pill tone={TONE[rfq.status as keyof typeof TONE] ?? "neutral"}>{rfq.status}</Pill>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Quantity</dt>
          <dd className="font-semibold">
            {formatNumber(rfq.quantity)} {rfq.unit}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Delivery</dt>
          <dd className="font-semibold">{formatDate(rfq.deliveryDate)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Target price</dt>
          <dd className="font-semibold">{rfq.targetPrice != null ? formatMoney(rfq.targetPrice) : "—"}</dd>
        </div>
        {rfq.quotePrice != null && (
          <div className="flex justify-between gap-3 rounded-lg bg-highlight-soft px-2 py-1.5">
            <dt className="font-semibold text-[#7a5a12]">Quoted</dt>
            <dd className="font-black">
              {formatMoney(rfq.quotePrice)} / {rfq.unit}
            </dd>
          </div>
        )}
        {rfq.quotePrice != null && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Order value</dt>
            <dd className="font-semibold">{formatMoney(rfq.quotePrice * rfq.quantity)}</dd>
          </div>
        )}
      </dl>
      {rfq.notes && <p className="mt-3 text-sm text-muted">“{rfq.notes}”</p>}
      <div className="mt-4 space-y-2">
        <FormError message={error} />
        {role === "grower" && live && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              act({ action: "quote", price: f.get("price"), notes: f.get("notes") });
            }}
          >
            <label className="label" htmlFor="qp">
              {rfq.status === "quoted" ? "Revise quote" : "Your quote"} (CAD per {rfq.unit})
            </label>
            <input id="qp" name="price" type="number" step="0.01" min="0" required defaultValue={rfq.quotePrice ?? rfq.targetPrice ?? ""} className="input" />
            <input name="notes" maxLength={2000} className="input" placeholder="Terms, delivery, pack size (optional)" />
            <div className="flex gap-2">
              <Button disabled={busy} className="flex-1">
                Send quote
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => confirm("Decline this RFQ?") && act({ action: "decline" })}>
                Decline
              </Button>
            </div>
          </form>
        )}
        {role === "buyer" && rfq.status === "quoted" && (
          <div className="flex gap-2">
            <Button disabled={busy} className="flex-1" onClick={() => act({ action: "accept" })}>
              Accept quote
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => act({ action: "withdraw" })}>
              Withdraw
            </Button>
          </div>
        )}
        {role === "buyer" && rfq.status === "open" && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => act({ action: "withdraw" })}>
            Withdraw RFQ
          </Button>
        )}
        {rfq.status === "accepted" && <p className="text-sm font-semibold text-leaf">Deal agreed — confirm logistics in the chat. Payments are arranged directly between members.</p>}
      </div>
    </div>
  );
}
