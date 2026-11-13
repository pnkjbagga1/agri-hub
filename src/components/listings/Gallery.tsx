"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/paths";

export function Gallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const list = photos.length ? photos : ["/seed/greens-1.svg"];
  return (
    <div>
      <div className="overflow-hidden rounded-[18px] border border-line bg-sand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(list[i])} alt={`${alt} — photo ${i + 1} of ${list.length}`} className="aspect-[4/3] w-full object-cover" />
      </div>
      {list.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {list.map((p, idx) => (
            <button key={p + idx} onClick={() => setI(idx)} className={cn("shrink-0 overflow-hidden rounded-xl ring-2 transition", idx === i ? "ring-primary" : "ring-transparent opacity-75 hover:opacity-100")} aria-label={`Show photo ${idx + 1}`} aria-pressed={idx === i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(p)} alt="" className="h-16 w-20 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
