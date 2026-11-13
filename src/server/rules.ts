import "server-only";
import { fail } from "./api";
import type { SessionUser } from "./session";
import { getSettings } from "./settings";

/** Members must finish onboarding (profile photo is mandatory) before acting. */
export async function assertCanAct(user: SessionUser, opts: { messaging?: boolean } = {}) {
  if (user.role === "admin") return;
  if (!user.profile?.photoUrl) fail(403, "Add your profile photo or logo first — it's required to take part on AGRI HUB.", { href: "/onboarding" });
  if (opts.messaging) {
    const s = await getSettings();
    if (s.requireEmailVerificationToMessage && !user.emailVerifiedAt) fail(403, "Please confirm your email address to send messages.", { href: "/settings" });
  }
}

/** Every uploaded file referenced must exist and belong to the expected owner (seed art is exempt). */
export async function assertOwnedMedia(urls: (string | null | undefined)[], ownerIds: string[]) {
  const { mediaKey } = await import("./api");
  const { db } = await import("@/lib/db");
  const keys = urls.filter((u): u is string => !!u).map(mediaKey).filter((k): k is string => !!k);
  if (!keys.length) return;
  const found = await db.upload.findMany({ where: { key: { in: keys }, ownerId: { in: ownerIds } }, select: { key: true } });
  if (found.length !== new Set(keys).size) fail(422, "One or more images weren't uploaded by this account.", { photos: "Re-upload your photos" });
}
