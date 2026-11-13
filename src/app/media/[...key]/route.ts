import { NextResponse, type NextRequest } from "next/server";
import { contentTypeFor, readLocal } from "@/server/storage";
import { getSessionUser } from "@/server/session";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const k = key.join("/");
  if (!/^[a-z]+\/\d{4}\/\d{2}\/[a-z0-9-]+\.(jpg|png|webp|avif|pdf)$/i.test(k)) return new NextResponse("Not found", { status: 404 });
  const isPrivate = k.startsWith("certificate/");
  if (isPrivate) {
    const user = await getSessionUser();
    const upload = user ? await db.upload.findUnique({ where: { key: k }, select: { ownerId: true } }) : null;
    if (!user || (user.role !== "admin" && upload?.ownerId !== user.id)) return new NextResponse("Not found", { status: 404 });
  }
  try {
    const data = await readLocal(k);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypeFor(k),
        "Cache-Control": isPrivate ? "private, no-store" : "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
