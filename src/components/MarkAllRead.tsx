"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { api } from "@/lib/client";

export function MarkAllRead() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await api("/notifications", { body: { all: true } });
        router.refresh();
      }}
    >
      Mark all read
    </Button>
  );
}
