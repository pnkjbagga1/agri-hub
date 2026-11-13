"use client";
import { asset } from "./paths";

export class ClientApiError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string> = {}, public details?: Record<string, unknown>) {
    super(message);
  }
}

/** Small JSON fetch wrapper for the AGRI HUB REST API. */
export async function api<T = Record<string, unknown>>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(asset(path.startsWith("/api") ? path : `/api/v1${path}`), {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const details = (data.details ?? {}) as Record<string, unknown>;
    const fields = (data.fields as Record<string, string>) ?? Object.fromEntries(Object.entries(details).filter(([, v]) => typeof v === "string")) as Record<string, string>;
    throw new ClientApiError(res.status, (data.error as string) ?? "Request failed", fields, details);
  }
  return data as T;
}

/** Resize + re-encode an image in the browser before upload (saves growers' mobile data and storage cost). */
export async function compressImage(file: File, maxSide = 1800, quality = 0.84): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/webp", quality));
    if (blob && blob.size < file.size) return blob;
    return file;
  } catch {
    return file;
  }
}

/** Two-step direct upload: get a signed URL, then PUT the bytes straight to storage. */
export async function uploadFile(file: File, kind: "avatar" | "cover" | "listing" | "post" | "event" | "certificate"): Promise<string> {
  const blob = kind === "certificate" && file.type === "application/pdf" ? file : await compressImage(file, kind === "avatar" ? 800 : 1800);
  const contentType = blob.type || file.type;
  const signed = await api<{ uploadUrl: string; publicUrl: string; headers: Record<string, string> }>("/uploads/sign", { body: { kind, contentType, size: blob.size } });
  const put = await fetch(asset(signed.uploadUrl), { method: "PUT", headers: signed.headers, body: blob });
  if (!put.ok) {
    let msg = "Upload failed";
    try {
      msg = ((await put.json()) as { error?: string }).error ?? msg;
    } catch {}
    throw new ClientApiError(put.status, msg);
  }
  return signed.publicUrl;
}
