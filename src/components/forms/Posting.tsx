"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { Field, FormError } from "@/components/forms";
import { ImageUploader } from "./Uploaders";
import { api, ClientApiError } from "@/lib/client";
import { CATEGORIES, EVENT_TYPES, FREQUENCIES, RESOURCE_TYPES, UNITS } from "@/lib/constants";

function useSubmit() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function submit(path: string, method: string, payload: unknown, to: string) {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api(path, { method, body: payload });
      router.push(to);
      router.refresh();
    } catch (e) {
      if (e instanceof ClientApiError) {
        setError(e.message);
        setFields(e.fields);
      } else setError("Could not save.");
      setBusy(false);
    }
  }
  return { error, fields, busy, submit };
}

const val = (f: FormData, k: string) => ((f.get(k) as string) ?? "").trim() || null;

export function DemandForm({ regions }: { regions: { id: string; name: string }[] }) {
  const { error, fields, busy, submit } = useSubmit();
  return (
    <form
      className="card grid gap-4 p-6 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        submit("/demand", "POST", { title: val(f, "title"), produce: val(f, "produce"), category: val(f, "category"), quantity: val(f, "quantity"), unit: val(f, "unit"), frequency: val(f, "frequency"), neededBy: val(f, "neededBy"), targetPrice: val(f, "targetPrice"), regionId: val(f, "regionId"), details: val(f, "details") }, "/dashboard/demand?posted=1");
      }}
    >
      <div className="sm:col-span-2">
        <FormError message={error} />
      </div>
      <Field label="Title" required className="sm:col-span-2" error={fields.title} hint="e.g. Weekly greenhouse peppers for 14 stores">
        <input name="title" required maxLength={120} className="input" />
      </Field>
      <Field label="Produce" required error={fields.produce}>
        <input name="produce" required maxLength={60} className="input" placeholder="Bell Peppers" />
      </Field>
      <Field label="Category" required>
        <select name="category" className="input">
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <Field label="Quantity" required error={fields.quantity}>
          <input name="quantity" type="number" step="any" min="0" required className="input" />
        </Field>
        <Field label="Unit">
          <select name="unit" className="input">
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Frequency">
        <select name="frequency" className="input">
          {FREQUENCIES.map((x) => (
            <option key={x.key} value={x.key}>
              {x.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Needed by" error={fields.neededBy}>
        <input name="neededBy" type="date" className="input" />
      </Field>
      <Field label="Target price (CAD per unit)" error={fields.targetPrice}>
        <input name="targetPrice" type="number" step="0.01" min="0" className="input" placeholder="optional" />
      </Field>
      <Field label="Delivery region">
        <select name="regionId" className="input">
          <option value="">My profile region</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Details" className="sm:col-span-2" hint="Specs, pack format, certifications required, delivery location">
        <textarea name="details" rows={4} maxLength={3000} className="input" />
      </Field>
      <div className="sm:col-span-2">
        <Button size="lg" disabled={busy}>
          {busy ? "Posting…" : "Post to demand board"}
        </Button>
        <p className="mt-2 text-xs text-muted">Growers with matching produce are notified automatically.</p>
      </div>
    </form>
  );
}

export type ResourceValues = { id?: string; type: string; title: string; summary: string; body: string | null; eligibility: string | null; amount: string | null; deadline: string | null; externalUrl: string | null; tags: string[] };

export function ResourceForm({ initial }: { initial?: ResourceValues }) {
  const { error, fields, busy, submit } = useSubmit();
  return (
    <form
      className="card grid gap-4 p-6 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const payload = {
          type: val(f, "type"),
          title: val(f, "title"),
          summary: val(f, "summary"),
          body: val(f, "body"),
          eligibility: val(f, "eligibility"),
          amount: val(f, "amount"),
          deadline: val(f, "deadline"),
          externalUrl: val(f, "externalUrl"),
          tags: (val(f, "tags") ?? "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        };
        submit(initial?.id ? `/resources/${initial.id}` : "/resources", initial?.id ? "PATCH" : "POST", payload, "/dashboard/resources");
      }}
    >
      <div className="sm:col-span-2">
        <FormError message={error} />
      </div>
      <Field label="Type" required>
        <select name="type" defaultValue={initial?.type ?? "program"} className="input">
          {RESOURCE_TYPES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Amount / terms" error={fields.amount} hint="e.g. Up to $50,000 · Free trial · 7-year terms">
        <input name="amount" defaultValue={initial?.amount ?? ""} maxLength={80} className="input" />
      </Field>
      <Field label="Title" required className="sm:col-span-2" error={fields.title}>
        <input name="title" defaultValue={initial?.title} required maxLength={140} className="input" />
      </Field>
      <Field label="Plain-language summary" required className="sm:col-span-2" error={fields.summary}>
        <textarea name="summary" defaultValue={initial?.summary} required minLength={10} maxLength={400} rows={3} className="input" />
      </Field>
      <Field label="Full description" className="sm:col-span-2" error={fields.body}>
        <textarea name="body" defaultValue={initial?.body ?? ""} rows={6} maxLength={6000} className="input" />
      </Field>
      <Field label="Eligibility" className="sm:col-span-2">
        <textarea name="eligibility" defaultValue={initial?.eligibility ?? ""} rows={2} maxLength={1000} className="input" />
      </Field>
      <Field label="Deadline" error={fields.deadline}>
        <input name="deadline" type="date" defaultValue={initial?.deadline ?? ""} className="input" />
      </Field>
      <Field label="Official link" error={fields.externalUrl}>
        <input name="externalUrl" defaultValue={initial?.externalUrl ?? ""} maxLength={500} className="input" placeholder="https://" />
      </Field>
      <Field label="Tags" className="sm:col-span-2" hint="Comma-separated, e.g. young farmers, irrigation, export">
        <input name="tags" defaultValue={initial?.tags.join(", ")} className="input" />
      </Field>
      <div className="sm:col-span-2">
        <Button size="lg" disabled={busy}>
          {busy ? "Saving…" : initial?.id ? "Save changes" : "Submit for review"}
        </Button>
      </div>
    </form>
  );
}

export function EventForm() {
  const { error, fields, busy, submit } = useSubmit();
  const [cover, setCover] = useState<string | null>(null);
  return (
    <form
      className="card grid gap-4 p-6 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        submit("/events", "POST", { title: val(f, "title"), description: val(f, "description"), type: val(f, "type"), startsAt: val(f, "startsAt") ? new Date(val(f, "startsAt")!).toISOString() : "", endsAt: val(f, "endsAt") ? new Date(val(f, "endsAt")!).toISOString() : null, location: val(f, "location"), onlineUrl: val(f, "onlineUrl"), capacity: val(f, "capacity"), coverUrl: cover }, "/dashboard/events");
      }}
    >
      <div className="sm:col-span-2">
        <FormError message={error} />
      </div>
      <div className="sm:col-span-2">
        <p className="label">Cover image</p>
        <ImageUploader value={cover} onChange={setCover} kind="event" label="Event cover (optional)" shape="wide" />
      </div>
      <Field label="Title" required className="sm:col-span-2" error={fields.title}>
        <input name="title" required maxLength={140} className="input" />
      </Field>
      <Field label="Type">
        <select name="type" className="input">
          {EVENT_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Capacity" error={fields.capacity}>
        <input name="capacity" type="number" min={1} className="input" placeholder="optional" />
      </Field>
      <Field label="Starts" required error={fields.startsAt}>
        <input name="startsAt" type="datetime-local" required className="input" />
      </Field>
      <Field label="Ends" error={fields.endsAt}>
        <input name="endsAt" type="datetime-local" className="input" />
      </Field>
      <Field label="Location" error={fields.location}>
        <input name="location" maxLength={200} className="input" placeholder="Abbotsford, BC" />
      </Field>
      <Field label="Online link" error={fields.onlineUrl} hint="Shared only with people who RSVP">
        <input name="onlineUrl" maxLength={500} className="input" placeholder="https://" />
      </Field>
      <Field label="Description" required className="sm:col-span-2" error={fields.description}>
        <textarea name="description" required minLength={10} maxLength={5000} rows={6} className="input" />
      </Field>
      <div className="sm:col-span-2">
        <Button size="lg" disabled={busy}>
          {busy ? "Submitting…" : "Submit event for review"}
        </Button>
      </div>
    </form>
  );
}
