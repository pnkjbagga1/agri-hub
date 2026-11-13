"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Notice } from "@/components/ui";
import { Field, FormError } from "@/components/forms";
import { ImageUploader } from "./Uploaders";
import { api, ClientApiError } from "@/lib/client";
import { BUYER_TYPES, CERTIFICATIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type ProfileFormValues = {
  orgName: string;
  contactName: string | null;
  tagline: string | null;
  bio: string | null;
  photoUrl: string | null;
  coverUrl: string | null;
  website: string | null;
  publicEmail: string | null;
  publicPhone: string | null;
  address: string | null;
  city: string | null;
  regionId: string | null;
  certifications: string[];
  specialties: string[];
  buyerType: string | null;
  farmSizeAcres: number | null;
  phone: string | null;
};

export function ProfileForm({ initial, role, regions, onboarding, redirectTo }: { initial: ProfileFormValues; role: string; regions: { id: string; name: string }[]; onboarding?: boolean; redirectTo?: string }) {
  const router = useRouter();
  const [photo, setPhoto] = useState(initial.photoUrl);
  const [cover, setCover] = useState(initial.coverUrl);
  const [certs, setCerts] = useState<string[]>(initial.certifications);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const isGrower = role === "grower";

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!photo) {
          setError("Please upload your profile photo or logo — it's required.");
          return;
        }
        const f = new FormData(e.currentTarget);
        const get = (k: string) => ((f.get(k) as string) ?? "").trim() || null;
        setBusy(true);
        setError(null);
        setFields({});
        setSaved(false);
        try {
          await api("/profile", {
            method: "PUT",
            body: {
              orgName: get("orgName"),
              contactName: get("contactName"),
              tagline: get("tagline"),
              bio: get("bio"),
              photoUrl: photo,
              coverUrl: cover,
              website: get("website"),
              publicEmail: get("publicEmail"),
              publicPhone: get("publicPhone"),
              address: get("address"),
              city: get("city"),
              regionId: get("regionId"),
              certifications: certs,
              specialties: (get("specialties") ?? "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              buyerType: get("buyerType"),
              farmSizeAcres: get("farmSizeAcres"),
              phone: get("phone"),
            },
          });
          setSaved(true);
          if (redirectTo) {
            router.push(redirectTo);
          }
          router.refresh();
        } catch (err) {
          if (err instanceof ClientApiError) {
            setError(err.message);
            setFields(err.fields);
          } else setError("Could not save your profile.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <FormError message={error} />
      {saved && !redirectTo && <Notice tone="success">Profile saved.</Notice>}
      <section className="card p-6">
        <h2 className="text-lg">Photo & cover</h2>
        <p className="mt-1 text-sm text-muted">Profiles with real photos get far more buyer inquiries. Your photo or logo is required.</p>
        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
          <ImageUploader value={photo} onChange={setPhoto} kind="avatar" label={isGrower ? "Farm photo / logo" : "Logo / photo"} required />
          <div className="flex-1">
            <ImageUploader value={cover} onChange={setCover} kind="cover" label="Cover image (optional)" shape="wide" />
          </div>
        </div>
        {fields.photoUrl && <p className="mt-2 text-sm text-danger">{fields.photoUrl}</p>}
      </section>

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-lg sm:col-span-2">About {isGrower ? "your farm" : "your organisation"}</h2>
        <Field label={isGrower ? "Farm name" : "Organisation name"} required error={fields.orgName}>
          <input name="orgName" defaultValue={initial.orgName} required maxLength={120} className="input" />
        </Field>
        <Field label="Contact person" error={fields.contactName}>
          <input name="contactName" defaultValue={initial.contactName ?? ""} maxLength={80} className="input" />
        </Field>
        <Field label="Tagline" className="sm:col-span-2" hint="One line buyers see on your card" error={fields.tagline}>
          <input name="tagline" defaultValue={initial.tagline ?? ""} maxLength={160} className="input" placeholder={isGrower ? "Third-generation blueberry growers on Sumas Prairie" : "What you offer the BC agri-food sector"} />
        </Field>
        <Field label="Bio / description" className="sm:col-span-2" error={fields.bio}>
          <textarea name="bio" defaultValue={initial.bio ?? ""} rows={5} maxLength={4000} className="input" />
        </Field>
        <Field label={isGrower ? "Crops / specialties" : "Specialties / services"} className="sm:col-span-2" hint="Comma-separated, e.g. blueberries, raspberries, processing">
          <input name="specialties" defaultValue={initial.specialties.join(", ")} className="input" />
        </Field>
        {role === "buyer" && (
          <Field label="Buyer type">
            <select name="buyerType" defaultValue={initial.buyerType ?? "retail"} className="input">
              {BUYER_TYPES.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {isGrower && (
          <Field label="Farm size (acres)" error={fields.farmSizeAcres}>
            <input name="farmSizeAcres" type="number" min={0} step="any" defaultValue={initial.farmSizeAcres ?? ""} className="input" />
          </Field>
        )}
      </section>

      {(isGrower || role === "buyer") && (
        <section className="card p-6">
          <h2 className="text-lg">Certifications</h2>
          <p className="mt-1 text-sm text-muted">{isGrower ? "Badges attach automatically to your listings. Upload certificates in your dashboard to earn a verified check." : "Certifications your operation holds."}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {CERTIFICATIONS.map((c) => {
              const on = certs.includes(c.key);
              return (
                <button key={c.key} type="button" aria-pressed={on} onClick={() => setCerts(on ? certs.filter((x) => x !== c.key) : [...certs, c.key])} className={cn("rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ring-inset", on ? c.tone : "bg-white text-muted ring-line hover:ring-primary/40")}>
                  {on ? "✓ " : ""}
                  {c.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-lg sm:col-span-2">Location & contact</h2>
        <Field label="City / town" error={fields.city}>
          <input name="city" defaultValue={initial.city ?? ""} maxLength={80} className="input" />
        </Field>
        <Field label="Region">
          <select name="regionId" defaultValue={initial.regionId ?? ""} className="input">
            <option value="">Other / outside BC</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Address (not shown publicly)" className="sm:col-span-2">
          <input name="address" defaultValue={initial.address ?? ""} maxLength={200} className="input" autoComplete="street-address" />
        </Field>
        <Field label="Website" error={fields.website}>
          <input name="website" defaultValue={initial.website ?? ""} maxLength={300} className="input" placeholder="https://" />
        </Field>
        <Field label="Your phone (private)" error={fields.phone}>
          <input name="phone" defaultValue={initial.phone ?? ""} maxLength={30} className="input" type="tel" />
        </Field>
        <Field label="Public email (optional)" error={fields.publicEmail}>
          <input name="publicEmail" defaultValue={initial.publicEmail ?? ""} type="email" className="input" />
        </Field>
        <Field label="Public phone (optional)" error={fields.publicPhone}>
          <input name="publicPhone" defaultValue={initial.publicPhone ?? ""} maxLength={30} className="input" />
        </Field>
      </section>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button size="lg" disabled={busy} className="shadow-[var(--shadow-lift)]">
          {busy ? "Saving…" : onboarding ? "Complete profile" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
