"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, CertBadge, Notice } from "@/components/ui";
import { Field, FormError } from "@/components/forms";
import { MultiPhotoUploader } from "@/components/forms/Uploaders";
import { api, ClientApiError } from "@/lib/client";
import { CATEGORIES, DELIVERY_OPTIONS, PRICING_METHODS, UNITS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ListingValues } from "./listing-defaults";

export function ListingForm({ initial, regions, certifications, growers }: { initial: ListingValues; regions: { id: string; name: string }[]; certifications: string[]; growers?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initial.photos);
  const [delivery, setDelivery] = useState<string[]>(initial.deliveryOptions);
  const [pricing, setPricing] = useState(initial.pricingMethod);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const editing = !!initial.id;

  async function save(form: HTMLFormElement, status: string) {
    const f = new FormData(form);
    const get = (k: string) => ((f.get(k) as string) ?? "").trim() || null;
    const payload = {
      title: get("title"),
      produce: get("produce"),
      variety: get("variety"),
      category: get("category"),
      description: get("description"),
      volume: get("volume"),
      unit: get("unit"),
      minOrder: get("minOrder"),
      price: pricing === "rfq" || pricing === "market" ? (get("price") ?? null) : get("price"),
      priceUnit: get("priceUnit") ?? get("unit"),
      pricingMethod: pricing,
      harvestStart: get("harvestStart"),
      harvestEnd: get("harvestEnd"),
      deliveryOptions: delivery,
      deliveryArea: get("deliveryArea"),
      pickupLocation: get("pickupLocation"),
      regionId: get("regionId"),
      photos,
      status,
      growerId: get("growerId") ?? undefined,
    };
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const r = await api<{ slug?: string }>(editing ? `/listings/${initial.id}` : "/listings", { method: editing ? "PATCH" : "POST", body: payload });
      router.push(growers ? "/admin/approvals" : editing || status !== "active" ? "/dashboard/listings" : `/marketplace/${r.slug}?published=1`);
      router.refresh();
    } catch (e) {
      if (e instanceof ClientApiError) {
        setError(e.message);
        setFields(e.fields);
      } else setError("Could not save the listing.");
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save(e.currentTarget, "active");
      }}
    >
      <FormError message={error} />
      {growers && (
        <section className="card p-6">
          <h2 className="text-lg">Assisted listing</h2>
          <p className="mb-3 text-sm text-muted">Create this listing on behalf of a grower (e.g. during the pilot or a phone intake). The grower is notified.</p>
          <Field label="Grower" required error={fields.growerId}>
            <select name="growerId" required className="input">
              <option value="">Choose a grower…</option>
              {growers.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
        </section>
      )}
      <section className="card p-6">
        <h2 className="text-lg">Photos</h2>
        <p className="mb-4 text-sm text-muted">At least one photo is required to publish. The first photo is the cover.</p>
        <MultiPhotoUploader value={photos} onChange={setPhotos} error={fields.photos} />
      </section>

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-lg sm:col-span-2">What are you selling?</h2>
        <Field label="Listing title" required className="sm:col-span-2" error={fields.title} hint="e.g. Organic Blueberries — 2027 Harvest">
          <input name="title" defaultValue={initial.title} required maxLength={120} className="input" />
        </Field>
        <Field label="Produce" required error={fields.produce}>
          <input name="produce" defaultValue={initial.produce} required maxLength={60} className="input" placeholder="Blueberries" list="produce-suggest" />
          <datalist id="produce-suggest">
            {["Blueberries", "Raspberries", "Strawberries", "Tomatoes", "Bell Peppers", "Cucumbers", "Apples", "Cherries", "Salad Greens", "Potatoes", "Sweet Corn", "Eggs", "Honey"].map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field label="Variety" error={fields.variety}>
          <input name="variety" defaultValue={initial.variety ?? ""} maxLength={60} className="input" placeholder="Duke, Bluecrop…" />
        </Field>
        <Field label="Category" required>
          <select name="category" defaultValue={initial.category} className="input">
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Region">
          <select name="regionId" defaultValue={initial.regionId ?? ""} className="input">
            <option value="">Use my profile region</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description" className="sm:col-span-2" error={fields.description}>
          <textarea name="description" defaultValue={initial.description ?? ""} rows={4} maxLength={4000} className="input" placeholder="Grade, pack format, cooling, storage, food-safety notes…" />
        </Field>
      </section>

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-lg sm:col-span-2">Volume, harvest & price</h2>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label="Available volume" required error={fields.volume}>
            <input name="volume" type="number" step="any" min="0" defaultValue={initial.volume ?? ""} required className="input" />
          </Field>
          <Field label="Unit">
            <select name="unit" defaultValue={initial.unit} className="input">
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Minimum order" error={fields.minOrder}>
          <input name="minOrder" type="number" step="any" min="0" defaultValue={initial.minOrder ?? ""} className="input" placeholder="optional" />
        </Field>
        <Field label="Harvest window — start" error={fields.harvestStart} hint="Leave empty if available year-round">
          <input name="harvestStart" type="date" defaultValue={initial.harvestStart ?? ""} className="input" />
        </Field>
        <Field label="Harvest window — end" error={fields.harvestEnd}>
          <input name="harvestEnd" type="date" defaultValue={initial.harvestEnd ?? ""} className="input" />
        </Field>
        <div className="sm:col-span-2">
          <p className="label">Pricing method</p>
          <div className="flex flex-wrap gap-2">
            {PRICING_METHODS.map((m) => (
              <button key={m.key} type="button" aria-pressed={pricing === m.key} onClick={() => setPricing(m.key)} className={cn("rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset", pricing === m.key ? "bg-primary text-white ring-primary" : "bg-white ring-line")}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label={`Price (CAD)${pricing === "rfq" || pricing === "market" ? " — optional" : ""}`} error={fields.price}>
            <input name="price" type="number" step="0.01" min="0" defaultValue={initial.price ?? ""} required={pricing === "fixed" || pricing === "negotiable"} className="input" />
          </Field>
          <Field label="Per">
            <select name="priceUnit" defaultValue={initial.priceUnit ?? initial.unit} className="input">
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-lg sm:col-span-2">Delivery & pickup</h2>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          {DELIVERY_OPTIONS.map((d) => {
            const on = delivery.includes(d.key);
            return (
              <button key={d.key} type="button" aria-pressed={on} onClick={() => setDelivery(on ? delivery.filter((x) => x !== d.key) : [...delivery, d.key])} className={cn("rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset", on ? "bg-primary-soft text-primary ring-primary/30" : "bg-white ring-line")}>
                {on ? "✓ " : ""}
                {d.label}
              </button>
            );
          })}
        </div>
        <Field label="Delivery area">
          <input name="deliveryArea" defaultValue={initial.deliveryArea ?? ""} maxLength={160} className="input" placeholder="Lower Mainland & Fraser Valley" />
        </Field>
        <Field label="Pickup location">
          <input name="pickupLocation" defaultValue={initial.pickupLocation ?? ""} maxLength={160} className="input" placeholder="Farm gate, Abbotsford" />
        </Field>
      </section>

      {certifications.length > 0 && (
        <Notice tone="success">
          <span className="mr-2">Certification badges auto-attached from your profile:</span>
          <span className="inline-flex flex-wrap gap-1.5 align-middle">
            {certifications.map((c) => (
              <CertBadge key={c} cert={c} />
            ))}
          </span>
        </Notice>
      )}

      <div className="sticky bottom-4 z-10 flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" size="lg" disabled={busy} onClick={(e) => save(e.currentTarget.form!, "draft")}>
          Save draft
        </Button>
        <Button size="lg" disabled={busy} className="shadow-[var(--shadow-lift)]">
          {busy ? "Saving…" : editing ? "Save & publish" : "Publish listing"}
        </Button>
      </div>
    </form>
  );
}
