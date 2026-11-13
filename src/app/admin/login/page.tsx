import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/server/session";
import { LoginForm } from "@/components/auth/LoginForm";
import { asset } from "@/lib/paths";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function AdminLoginPage() {
  const user = await getSessionUser();
  if (user?.role === "admin") redirect("/admin");
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-primary px-4 py-10">
      <div className="w-full max-w-md rounded-[22px] bg-cream p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <Image src={asset("/brand/GRIS_Logo_Badge.png")} alt="" width={52} height={53} />
          <div>
            <p className="font-display text-xl font-black text-primary">
              Agri <span className="text-highlight">Hub</span> Admin
            </p>
            <p className="text-xs font-semibold tracking-widest text-muted uppercase">GRIS Canada staff only</p>
          </div>
        </div>
        <p className="mt-6 flex items-center gap-2 rounded-xl bg-white p-3 text-sm text-muted ring-1 ring-line">
          <ShieldCheck className="size-5 shrink-0 text-leaf" /> Protected area. Sign-ins are logged and two-factor authentication is enforced when enabled.
        </p>
        <div className="mt-6">
          <Suspense>
            <LoginForm portal="admin" />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
