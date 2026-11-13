"use client";

import { useRouter } from "next/navigation";
import { Laptop, Smartphone } from "lucide-react";
import { Button, Pill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";

type S = { id: string; userAgent: string | null; ip: string | null; createdAt: string; lastSeenAt: string; current: boolean };

function device(ua: string | null) {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Device";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

/** Active sessions ("where you're signed in") with per-device sign-out. */
export function SessionsList({ sessions }: { sessions: S[] }) {
  const router = useRouter();
  return (
    <div className="card p-6">
      <h2 className="text-lg">Where you&apos;re signed in</h2>
      <ul className="mt-4 divide-y divide-line">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
            {/Mobile|iPhone|Android/.test(s.userAgent ?? "") ? <Smartphone className="size-5 text-leaf" /> : <Laptop className="size-5 text-leaf" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {device(s.userAgent)} {s.current && <Pill tone="green">this device</Pill>}
              </p>
              <p className="text-xs text-muted">
                Signed in {formatDateTime(s.createdAt)} · last active {formatDateTime(s.lastSeenAt)}
              </p>
            </div>
            {!s.current && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await api(`/sessions/${s.id}`, { method: "DELETE" });
                  router.refresh();
                }}
              >
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
