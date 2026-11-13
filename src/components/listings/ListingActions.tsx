"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Flag, Heart, MessageSquare, FileText } from "lucide-react";
import { Button, buttonClass, Notice } from "@/components/ui";
import { Field, FormError, Modal } from "@/components/forms";
import { api, ClientApiError } from "@/lib/client";
import { REPORT_REASONS, UNITS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Props = {
  listingId: string;
  growerId: string;
  growerName: string;
  unit: string;
  signedIn: boolean;
  isOwner: boolean;
  saved: boolean;
  threadId?: string | null;
  path: string;
};

export function ListingActions(p: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "rfq" | "msg">(null);
  const [saved, setSaved] = useState(p.saved);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (p.isOwner)
    return (
      <div className="flex flex-wrap gap-3">
        <Link href={`/dashboard/listings/${p.listingId}/edit`} className={buttonClass("primary", "lg")}>
          Edit listing
        </Link>
        <Link href="/dashboard/listings" className={buttonClass("outline", "lg")}>
          My listings
        </Link>
      </div>
    );

  if (!p.signedIn)
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <Link href={`/login?next=${encodeURIComponent(p.path)}`} className={buttonClass("primary", "lg")}>
            <FileText className="size-5" /> Send Inquiry / RFQ
          </Link>
          <Link href="/signup?role=buyer" className={buttonClass("outline", "lg")}>
            <MessageSquare className="size-5" /> Message Grower
          </Link>
        </div>
        <p className="text-sm text-muted">Sign in or join free to contact {p.growerName}.</p>
      </div>
    );

  async function submit(path: string, payload: unknown) {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const r = await api<{ threadId: string }>(path, { body: payload });
      router.push(`/messages/${r.threadId}`);
    } catch (e) {
      if (e instanceof ClientApiError) {
        setError(e.message);
        setFields(e.fields);
      } else setError("Something went wrong.");
      setBusy(false);
    }
  }

  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    try {
      await api(`/favorites/${p.listingId}`, { method: next ? "POST" : "DELETE" });
    } catch {
      setSaved(!next);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={() => setModal("rfq")}>
          <FileText className="size-5" /> Send Inquiry / RFQ
        </Button>
        {p.threadId ? (
          <Link href={`/messages/${p.threadId}`} className={buttonClass("outline", "lg")}>
            <MessageSquare className="size-5" /> Open conversation
          </Link>
        ) : (
          <Button size="lg" variant="outline" onClick={() => setModal("msg")}>
            <MessageSquare className="size-5" /> Message Grower
          </Button>
        )}
        <button onClick={toggleSave} className={cn(buttonClass("ghost", "lg"), "px-4")} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save listing"}>
          <Heart className={cn("size-5", saved && "fill-danger text-danger")} />
        </button>
      </div>

      <Modal open={modal === "rfq"} onClose={() => setModal(null)} title={`Request a quote from ${p.growerName}`}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            submit("/rfqs", { listingId: p.listingId, quantity: f.get("quantity"), unit: f.get("unit"), deliveryDate: f.get("deliveryDate") || null, targetPrice: f.get("targetPrice") || null, notes: f.get("notes") });
          }}
        >
          <FormError message={error} />
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field label="Quantity" required error={fields.quantity}>
              <input name="quantity" type="number" step="any" min="0" required className="input" placeholder="e.g. 2000" />
            </Field>
            <Field label="Unit">
              <select name="unit" defaultValue={p.unit} className="input">
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Delivery date" error={fields.deliveryDate}>
              <input name="deliveryDate" type="date" className="input" />
            </Field>
            <Field label="Target price (CAD per unit)" error={fields.targetPrice}>
              <input name="targetPrice" type="number" step="0.01" min="0" className="input" placeholder="optional" />
            </Field>
          </div>
          <Field label="Notes" hint="Pack size, delivery location, frequency, certifications needed…">
            <textarea name="notes" rows={3} maxLength={2000} className="input" />
          </Field>
          <Button className="w-full" size="lg" disabled={busy}>
            {busy ? "Sending…" : "Send RFQ"}
          </Button>
        </form>
      </Modal>

      <Modal open={modal === "msg"} onClose={() => setModal(null)} title={`Message ${p.growerName}`}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            submit("/threads", { recipientId: p.growerId, listingId: p.listingId, body: f.get("body") });
          }}
        >
          <FormError message={error} />
          <textarea name="body" rows={5} required maxLength={4000} className="input" placeholder="Hi! I'm interested in this listing — can you confirm availability and delivery?" />
          <Button className="w-full" size="lg" disabled={busy}>
            {busy ? "Sending…" : "Send message"}
          </Button>
        </form>
      </Modal>
    </>
  );
}

export function ReportButton({ targetType, targetId, signedIn, label = "Report" }: { targetType: string; targetId: string; signedIn: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!signedIn) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-danger">
        <Flag className="size-3.5" /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Report to GRIS Canada moderators">
        {done ? (
          <Notice tone="success">Thanks — our moderation team will review this within 2 business days.</Notice>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await api("/reports", { body: { targetType, targetId, reason: f.get("reason"), details: f.get("details") } });
                setDone(true);
              } catch (err) {
                setError(err instanceof ClientApiError ? err.message : "Could not send report");
              }
            }}
          >
            <FormError message={error} />
            <Field label="Reason">
              <select name="reason" className="input" required>
                {REPORT_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Details">
              <textarea name="details" rows={3} maxLength={1000} className="input" />
            </Field>
            <Button variant="danger" className="w-full">
              Send report
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
