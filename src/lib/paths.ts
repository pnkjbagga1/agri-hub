// AGRI HUB can be mounted under a sub-path (e.g. griscanada.org/hub) via NEXT_PUBLIC_BASE_PATH.
// next/link, router.push and redirect() add it automatically; raw URLs (fetch, <img>, emails) use these helpers.
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

/** Prefix a root-relative path ("/media/…", "/api/…") with the base path. Absolute URLs pass through. */
export function asset(path: string | null | undefined): string {
  if (!path) return "";
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (BASE_PATH && (path === BASE_PATH || path.startsWith(BASE_PATH + "/"))) return path;
  return BASE_PATH + path;
}
