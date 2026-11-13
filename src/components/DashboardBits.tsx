"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileUp, Trash2 } from "lucide-react";
import { Button, Pill } from "@/components/ui";
import { Field, FormError } from "@/components/forms";
import { api, ClientApiError, uploadFile } from "@/lib/client";
import { asset } from "@/lib/paths";
import { CERT_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export function CertDocs({ docs }: { docs: { id: string; type: string; status: string; documentUrl: string; expiresAt: string | null; reviewNote: string | null }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section id="certificates" className="card scroll-mt-24 p-6">
      <h2 className="text-lg">Certificate documents</h2>
      <p className="mt-1 text-sm text-muted">Upload your certificates (PDF or photo). GRIS Canada verifies them and your badges get a verified check.</p>
      {docs.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <a href={asset(d.documentUrl)} target="_blank" rel="noopener noreferrer" className="font-semibold text-leaf hover:underline">
                {CERT_LABEL[d.type] ?? d.type}
              </a>
              <Pill tone={d.status === "verified" ? "green" : d.status === "rejected" ? "red" : "neutral"}>{d.status}</Pill>
              {d.expiresAt && <span className="text-muted">expires {formatDate(d.expiresAt)}</span>}
              {d.reviewNote && <span className="text-muted">— {d.reviewNote}</span>}
              <button
                className="ml-auto grid size-8 place-items-center rounded-full text-muted hover:bg-sand hover:text-danger"
                aria-label="Delete document"
                onClick={async () => {
                  await api(`/profile/certs/${d.id}`, { method: "DELETE" });
                  router.refresh();
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const file = f.get("file") as File | null;
          if (!file || !file.size) return setError("Choose a file.");
          setBusy(true);
          setError(null);
          try {
            const url = await uploadFile(file, "certificate");
            await api("/profile/certs", { body: { type: f.get("type"), documentUrl: url, expiresAt: f.get("expiresAt") || null } });
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof ClientApiError ? err.message : "Upload failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Certificate">
          <select name="type" className="input">
            {Object.entries(CERT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Expiry date">
          <input name="expiresAt" type="date" className="input" />
        </Field>
        <div />
        <input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="text-sm sm:col-span-2" required />
        <Button disabled={busy}>
          <FileUp className="size-4" /> {busy ? "Uploading…" : "Upload"}
        </Button>
      </form>
      <FormError message={error} />
    </section>
  );
}

export function LeadStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  return (
    <select
      defaultValue={status}
      onChange={async (e) => {
        await api(`/interests/${id}`, { method: "PATCH", body: { status: e.target.value } });
        router.refresh();
      }}
      className="input h-9 w-auto rounded-full! py-0 text-sm"
      aria-label="Lead status"
    >
      <option value="new">New</option>
      <option value="contacted">Contacted</option>
      <option value="closed">Closed</option>
    </select>
  );
}

export function DeleteButton({ path, label = "Delete", confirmText }: { path: string; label?: string; confirmText: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        if (!confirm(confirmText)) return;
        await api(path, { method: "DELETE" });
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}

export function ToggleDemand({ id, isOpen }: { id: string; isOpen: boolean }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await api(`/demand/${id}`, { method: "PATCH", body: { isOpen: !isOpen } });
        router.refresh();
      }}
    >
      {isOpen ? "Close" : "Reopen"}
    </Button>
  );
}
