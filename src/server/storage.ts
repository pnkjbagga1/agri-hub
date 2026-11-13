import "server-only";
import { createHmac } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { safeEqual } from "./security";

/**
 * Direct-to-storage uploads with signed URLs:
 *  - "s3": presigned PUT straight to AWS S3 or Cloudflare R2 (recommended at scale; bytes never touch our servers)
 *  - "db": signed PUT stored in Postgres (zero-setup hosting, e.g. Vercel + Neon for the MVP pilot)
 *  - "local": development emulator writing into ./storage
 */

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const DOC_TYPES = ["application/pdf", ...IMAGE_TYPES] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "application/pdf": "pdf" };

export const driver = (): "s3" | "db" | "local" => (process.env.STORAGE_DRIVER === "s3" ? "s3" : process.env.STORAGE_DRIVER === "db" ? "db" : "local");
const localRoot = () => path.resolve(process.cwd(), "storage");

export function makeKey(ownerId: string, kind: string, contentType: string) {
  const rand = crypto.randomUUID().replace(/-/g, "");
  const d = new Date();
  return `${kind}/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${ownerId.slice(-8)}-${rand}.${EXT[contentType] ?? "bin"}`;
}

function sign(payload: string) {
  return createHmac("sha256", process.env.JWT_SECRET!).update(`upload:${payload}`).digest("base64url");
}

export async function signUpload(key: string, contentType: string, size: number) {
  const expires = Date.now() + 10 * 60 * 1000;
  if (driver() === "s3") {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
    });
    const cmd = new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: key, ContentType: contentType, ContentLength: size, CacheControl: "public, max-age=31536000, immutable" });
    const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 600 });
    return { uploadUrl, publicUrl: `${process.env.S3_PUBLIC_BASE_URL!.replace(/\/$/, "")}/${key}`, headers: { "Content-Type": contentType } };
  }
  const payload = `${key}|${contentType}|${size}|${expires}`;
  const token = Buffer.from(payload).toString("base64url") + "." + sign(payload);
  return { uploadUrl: `/api/v1/uploads/local?token=${token}`, publicUrl: `/media/${key}`, headers: { "Content-Type": contentType } };
}

export function verifyLocalToken(token: string) {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const payload = Buffer.from(b64, "base64url").toString();
  if (!safeEqual(sign(payload), sig)) return null;
  const [key, contentType, size, expires] = payload.split("|");
  if (!key || !contentType || Number(expires) < Date.now()) return null;
  return { key, contentType, size: Number(size) };
}

/** Checks the real file signature so a renamed script can't pose as an image. */
export function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(4, 12).toString().startsWith("ftypavi")) return "image/avif";
  if (buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

function safeLocalPath(key: string) {
  const root = localRoot();
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("bad key");
  return full;
}

export async function writeLocal(key: string, data: Buffer, contentType: string) {
  if (driver() === "db") {
    const { db } = await import("@/lib/db");
    await db.storedFile.upsert({ where: { key }, create: { key, contentType, size: data.length, data: new Uint8Array(data) }, update: { contentType, size: data.length, data: new Uint8Array(data) } });
    return;
  }
  const full = safeLocalPath(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

export async function readLocal(key: string): Promise<Buffer> {
  if (driver() === "db") {
    const { db } = await import("@/lib/db");
    const f = await db.storedFile.findUnique({ where: { key } });
    if (!f) throw new Error("not found");
    return Buffer.from(f.data);
  }
  return readFile(safeLocalPath(key));
}

export function contentTypeFor(key: string) {
  const ext = key.split(".").pop()!;
  return Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
}
