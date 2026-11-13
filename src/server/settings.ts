import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type SiteSettings = {
  /** "post": new content is visible immediately and reviewed afterwards; "pre": hidden until approved */
  moderation: "post" | "pre";
  announcement: string | null;
  requireEmailVerificationToMessage: boolean;
};

const DEFAULTS: SiteSettings = { moderation: "post", announcement: null, requireEmailVerificationToMessage: false };

export const getSettings = cache(async (): Promise<SiteSettings> => {
  const rows = await db.siteSetting.findMany();
  const out = { ...DEFAULTS } as Record<string, unknown>;
  for (const r of rows) out[r.key] = r.value;
  return out as SiteSettings;
});

export async function setSetting(key: keyof SiteSettings, value: unknown) {
  await db.siteSetting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue }, update: { value: value as Prisma.InputJsonValue } });
}

/** Approval filter for public visibility, honouring the moderation mode. */
export async function visibleApproval() {
  const s = await getSettings();
  return s.moderation === "pre" ? { approval: "approved" as const } : { approval: { not: "rejected" as const } };
}
