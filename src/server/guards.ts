import "server-only";
import { redirect, notFound } from "next/navigation";
import type { RoleKey } from "@/lib/constants";
import { PARTNER_ROLES } from "@/lib/constants";
import { getSessionUser } from "./session";

export async function requireUser(next = "/dashboard") {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** Signed-in user whose profile is set up (photo is mandatory). */
export async function requireOnboarded(next = "/dashboard") {
  const user = await requireUser(next);
  if (user.role !== "admin" && (!user.profile || !user.profile.photoUrl)) redirect("/onboarding");
  return user;
}

export async function requireRole(roles: RoleKey[], next = "/dashboard") {
  const user = await requireOnboarded(next);
  if (!roles.includes(user.role as RoleKey)) notFound();
  return user;
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "admin") notFound();
  return user;
}

export const isPartner = (role: string) => PARTNER_ROLES.includes(role as RoleKey);
