"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Star, Trash2, UploadCloud } from "lucide-react";
import { uploadFile, ClientApiError } from "@/lib/client";
import { asset } from "@/lib/paths";
import { cn } from "@/lib/utils";

type Kind = "avatar" | "cover" | "listing" | "post" | "event";

export function ImageUploader({ value, onChange, kind, label, shape = "square", required }: { value: string | null; onChange: (url: string | null) => void; kind: Kind; label: string; shape?: "square" | "wide"; required?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadFile(f, kind));
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files);
        }}
        className={cn("group relative grid place-items-center overflow-hidden border-2 border-dashed bg-white transition hover:border-primary", value ? "border-transparent" : "border-line", shape === "square" ? "size-32 rounded-[22px]" : "aspect-[16/5] w-full rounded-[18px]")}
        aria-label={value ? `Change ${label}` : `Upload ${label}`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset(value)} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 px-2 text-center text-xs font-semibold text-muted">
            <ImagePlus className="size-6 text-leaf" />
            {label}
            {required && <span className="text-danger">Required</span>}
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-white/75">
            <Loader2 className="size-6 animate-spin text-primary" />
          </span>
        )}
        {value && !busy && <span className="absolute inset-x-0 bottom-0 bg-ink/60 py-1 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100">Change</span>}
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => pick(e.target.files)} tabIndex={-1} />
      {error && <p className="mt-1 text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}

/** Multi-photo uploader for listings: drag & drop, phone camera capture, reorder (set cover), remove. */
export function MultiPhotoUploader({ value, onChange, max = 10, error: fieldError }: { value: string[]; onChange: (urls: string[]) => void; max?: number; error?: string }) {
  const files = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  async function add(list: FileList | null) {
    if (!list?.length) return;
    const room = max - value.length;
    const picked = Array.from(list).slice(0, room);
    if (!picked.length) return setError(`Up to ${max} photos.`);
    setError(null);
    setBusy(picked.length);
    const urls: string[] = [];
    for (const f of picked) {
      try {
        urls.push(await uploadFile(f, "listing"));
      } catch (e) {
        setError(e instanceof ClientApiError ? e.message : "One photo failed to upload");
      }
      setBusy((b) => b - 1);
    }
    onChange([...value, ...urls]);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={cn("rounded-[18px] border-2 border-dashed bg-white p-5 text-center transition", over ? "border-primary bg-primary-soft" : fieldError ? "border-danger" : "border-line")}
      >
        <UploadCloud className="mx-auto size-8 text-leaf" />
        <p className="mt-2 font-semibold">Drag photos here</p>
        <p className="text-sm text-muted">JPG, PNG or WebP · up to {max} photos · compressed automatically</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => files.current?.click()} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-leaf">
            <ImagePlus className="size-4" /> Choose photos
          </button>
          <button type="button" onClick={() => camera.current?.click()} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-line hover:ring-primary/50">
            <Camera className="size-4" /> Take photo
          </button>
        </div>
        <input ref={files} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => add(e.target.files)} tabIndex={-1} />
        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => add(e.target.files)} tabIndex={-1} />
      </div>
      {(error || fieldError) && <p className="mt-2 text-sm font-medium text-danger" role="alert">{error ?? fieldError}</p>}
      {(value.length > 0 || busy > 0) && (
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {value.map((u, i) => (
            <li key={u} className="group relative aspect-square overflow-hidden rounded-xl bg-sand ring-1 ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(u)} alt={`Photo ${i + 1}`} className="size-full object-cover" />
              {i === 0 && <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">Cover</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink/55 p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                {i > 0 ? (
                  <button type="button" onClick={() => onChange([u, ...value.filter((x) => x !== u)])} className="grid size-7 place-items-center rounded-lg text-white hover:bg-white/20" aria-label="Make cover photo">
                    <Star className="size-4" />
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" onClick={() => onChange(value.filter((x) => x !== u))} className="grid size-7 place-items-center rounded-lg text-white hover:bg-white/20" aria-label="Remove photo">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
          {Array.from({ length: busy }).map((_, i) => (
            <li key={`b${i}`} className="grid aspect-square place-items-center rounded-xl bg-sand">
              <Loader2 className="size-5 animate-spin text-primary" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
