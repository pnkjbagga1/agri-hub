"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Notice } from "@/components/ui";
import { Field, FormError } from "@/components/forms";
import { api, ClientApiError } from "@/lib/client";

const msg = (e: unknown) => (e instanceof ClientApiError ? e.message : "Action failed");

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: string, payload: object) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/${action}`, { body: payload });
      router.refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export function Moderate({ type, id, approval, featured, allowFeature = true }: { type: string; id: string; approval?: string; featured?: boolean; allowFeature?: boolean }) {
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {approval !== "approved" && (
        <Button size="sm" disabled={busy} onClick={() => run("moderate", { type, id, action: "approve" })}>
          Approve
        </Button>
      )}
      {approval !== "rejected" && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            const reason = prompt("Reason shown to the member (optional):") ?? undefined;
            run("moderate", { type, id, action: "reject", reason });
          }}
        >
          Reject
        </Button>
      )}
      {allowFeature && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run("moderate", { type, id, action: featured ? "unfeature" : "feature" })}>
          {featured ? "Unfeature" : "★ Feature"}
        </Button>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

export function HideToggle({ type, id, hidden }: { type: "post" | "comment" | "review"; id: string; hidden: boolean }) {
  const { busy, run } = useAction();
  return (
    <Button size="sm" variant={hidden ? "outline" : "danger"} disabled={busy} onClick={() => run("moderate", { type, id, action: hidden ? "unhide" : "hide" })}>
      {hidden ? "Unhide" : "Hide"}
    </Button>
  );
}

export function CertReview({ id }: { id: string }) {
  const { busy, error, run } = useAction();
  return (
    <div className="flex gap-1.5">
      <Button size="sm" disabled={busy} onClick={() => run("cert", { id, status: "verified" })}>
        Verify
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("cert", { id, status: "rejected", note: prompt("Note to member:") ?? undefined })}>
        Reject
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

export function UserActions({ id, status, verified, emailVerified }: { id: string; status: string; verified: boolean; emailVerified: boolean }) {
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-wrap gap-2">
      {status === "active" ? (
        <Button size="sm" variant="danger" disabled={busy} onClick={() => confirm("Suspend this account? They will be signed out immediately.") && run("user", { id, action: "suspend", reason: prompt("Reason (emailed to the member):") ?? undefined })}>
          Suspend
        </Button>
      ) : (
        <Button size="sm" disabled={busy} onClick={() => run("user", { id, action: "activate" })}>
          Reactivate
        </Button>
      )}
      <Button size="sm" variant={verified ? "outline" : "secondary"} disabled={busy} onClick={() => run("user", { id, action: verified ? "unverify" : "verify" })}>
        {verified ? "Remove verified badge" : "✓ Verify organisation"}
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => run("user", { id, action: "revoke_sessions" })}>
        Sign out everywhere
      </Button>
      {!emailVerified && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run("user", { id, action: "resend_verification" })}>
          Resend verification
        </Button>
      )}
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}

export function ReportActions({ id }: { id: string }) {
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" disabled={busy} onClick={() => run("report", { id, status: "resolved", resolution: prompt("Resolution note (sent to reporter):") ?? undefined })}>
        Resolve
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("report", { id, status: "dismissed" })}>
        Dismiss
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

type Kpi = { key: string; label: string; targetValue: number; targetLabel: string | null; currentValue: number | null; metric: string | null; unit: string | null };

export function KpiEditor({ items }: { items: Kpi[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [state, setState] = useState<{ ok?: boolean; error?: string }>({});
  const set = (key: string, patch: Partial<Kpi>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api("/admin/kpis", { body: { items: rows.map((r) => ({ key: r.key, label: r.label, targetValue: r.targetValue, targetLabel: r.targetLabel, currentValue: r.metric ? undefined : r.currentValue })) } });
          setState({ ok: true });
          router.refresh();
        } catch (err) {
          setState({ error: msg(err) });
        }
      }}
    >
      {state.ok && <Notice tone="success">Targets saved.</Notice>}
      <FormError message={state.error} />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line bg-cream text-xs text-muted uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Metric</th>
              <th className="px-3 py-3 text-left">Target (number)</th>
              <th className="px-3 py-3 text-left">Display label</th>
              <th className="px-4 py-3 text-left">Current value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-4 py-2">
                  <input value={r.label} onChange={(e) => set(r.key, { label: e.target.value })} className="input py-1.5" aria-label="Label" />
                </td>
                <td className="px-3 py-2">
                  <input type="number" step="any" value={r.targetValue} onChange={(e) => set(r.key, { targetValue: Number(e.target.value) })} className="input w-32 py-1.5" aria-label="Target" />
                </td>
                <td className="px-3 py-2">
                  <input value={r.targetLabel ?? ""} onChange={(e) => set(r.key, { targetLabel: e.target.value })} className="input w-40 py-1.5" aria-label="Target label" />
                </td>
                <td className="px-4 py-2">
                  {r.metric ? (
                    <span className="text-xs font-semibold text-leaf">Live from database ({r.metric})</span>
                  ) : (
                    <input type="number" step="any" value={r.currentValue ?? ""} onChange={(e) => set(r.key, { currentValue: e.target.value === "" ? null : Number(e.target.value) })} className="input w-32 py-1.5" aria-label="Current value" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button size="lg">Save targets</Button>
    </form>
  );
}

export function SettingsForm({ moderation, announcement, requireEmail }: { moderation: string; announcement: string | null; requireEmail: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ ok?: boolean; error?: string }>({});
  return (
    <form
      className="card space-y-5 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          await api("/admin/settings", { body: { moderation: f.get("moderation"), announcement: f.get("announcement"), requireEmailVerificationToMessage: f.get("requireEmail") === "on" } });
          setState({ ok: true });
          router.refresh();
        } catch (err) {
          setState({ error: msg(err) });
        }
      }}
    >
      <h2 className="text-lg">Platform settings</h2>
      {state.ok && <Notice tone="success">Saved.</Notice>}
      <FormError message={state.error} />
      <fieldset>
        <legend className="label">Moderation mode</legend>
        <label className="flex items-start gap-2.5 py-1">
          <input type="radio" name="moderation" value="post" defaultChecked={moderation === "post"} className="mt-1 accent-[#0c3520]" />
          <span>
            <strong>Post-moderation</strong> — new listings & profiles go live immediately; moderators review after. Best for growth.
          </span>
        </label>
        <label className="flex items-start gap-2.5 py-1">
          <input type="radio" name="moderation" value="pre" defaultChecked={moderation === "pre"} className="mt-1 accent-[#0c3520]" />
          <span>
            <strong>Pre-moderation</strong> — content stays hidden until approved. Best for maximum trust.
          </span>
        </label>
      </fieldset>
      <label className="flex items-center gap-2.5">
        <input type="checkbox" name="requireEmail" defaultChecked={requireEmail} className="size-4 accent-[#0c3520]" /> Require a confirmed email before members can message or send RFQs
      </label>
      <Field label="Announcement banner" hint="Shown at the top of every page. Leave empty to hide.">
        <input name="announcement" defaultValue={announcement ?? ""} maxLength={240} className="input" />
      </Field>
      <Button>Save settings</Button>
    </form>
  );
}

export function SpaceForm() {
  const { busy, error, run } = useAction();
  return (
    <form
      className="card space-y-3 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run("space", { name: f.get("name"), description: f.get("description"), isLocked: f.get("isLocked") === "on" });
        e.currentTarget.reset();
      }}
    >
      <h2 className="text-lg">New community space</h2>
      <FormError message={error} />
      <input name="name" required maxLength={60} className="input" placeholder="e.g. Dairy & Livestock" aria-label="Space name" />
      <input name="description" maxLength={240} className="input" placeholder="Short description" aria-label="Description" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isLocked" className="accent-[#0c3520]" /> Announcements only (admins post)
      </label>
      <Button disabled={busy}>Create space</Button>
    </form>
  );
}

export function RegionForm() {
  const { busy, error, run } = useAction();
  return (
    <form
      className="card space-y-3 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run("region", { name: f.get("name"), province: f.get("province"), country: f.get("country"), lat: f.get("lat"), lng: f.get("lng"), specialties: String(f.get("specialties") ?? "").split(",").map((s) => s.trim()).filter(Boolean) });
      }}
    >
      <h2 className="text-lg">Add a region</h2>
      <p className="text-sm text-muted">Expand to a new province or country without code changes.</p>
      <FormError message={error} />
      <input name="name" required className="input" placeholder="e.g. Niagara Peninsula" aria-label="Region name" />
      <div className="grid grid-cols-2 gap-3">
        <input name="province" required maxLength={10} className="input" placeholder="Province / state (ON)" aria-label="Province" />
        <input name="country" required maxLength={2} className="input" placeholder="Country (CA)" aria-label="Country" />
        <input name="lat" required type="number" step="any" className="input" placeholder="Latitude" aria-label="Latitude" />
        <input name="lng" required type="number" step="any" className="input" placeholder="Longitude" aria-label="Longitude" />
      </div>
      <input name="specialties" className="input" placeholder="Specialties (comma-separated)" aria-label="Specialties" />
      <Button disabled={busy}>Add region</Button>
    </form>
  );
}
