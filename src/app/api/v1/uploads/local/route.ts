import { NextResponse, type NextRequest } from "next/server";
import { readLocal, sniff, verifyLocalToken, writeLocal } from "@/server/storage";

/**
 * Signed-PUT receiver for the "local" (dev) and "db" storage drivers — same contract as S3/R2.
 * With STORAGE_DRIVER=s3 this endpoint refuses all requests.
 */
export async function PUT(req: NextRequest) {
  if (process.env.STORAGE_DRIVER === "s3") return NextResponse.json({ error: "Local storage disabled" }, { status: 404 });
  const claims = verifyLocalToken(req.nextUrl.searchParams.get("token") ?? "");
  if (!claims) return NextResponse.json({ error: "Upload link is invalid or expired." }, { status: 403 });
  if (req.headers.get("content-type") !== claims.contentType) return NextResponse.json({ error: "Content type mismatch." }, { status: 400 });
  // single use: never overwrite an object that was already uploaded
  if (await readLocal(claims.key).then(() => true, () => false)) return NextResponse.json({ error: "This upload link was already used." }, { status: 409 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > claims.size + 1024 || buf.length === 0) return NextResponse.json({ error: "File size mismatch." }, { status: 413 });
  const real = sniff(buf);
  if (real !== claims.contentType) return NextResponse.json({ error: "File contents don't match its type." }, { status: 415 });
  await writeLocal(claims.key, buf, claims.contentType);
  return new NextResponse(null, { status: 200 });
}
