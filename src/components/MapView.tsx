"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { asset } from "@/lib/paths";

export type MapPoint = { id: string; lat: number; lng: number; title: string; subtitle?: string; href: string; image?: string | null };

/** Leaflet + OpenStreetMap map of listings or members. Loaded client-side only. */
export default function MapView({ points, height = 520 }: { points: MapPoint[]; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false }).setView([49.4, -121.5], 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(map);
      const icon = L.divIcon({ className: "", html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#0c3520;transform:rotate(-45deg);border:3px solid #bc8a2e;box-shadow:0 4px 10px rgba(0,0,0,.25)"></div>', iconSize: [22, 22], iconAnchor: [11, 22] });
      const bounds: [number, number][] = [];
      for (const p of points) {
        const wrap = document.createElement("div");
        wrap.style.minWidth = "180px";
        if (p.image) {
          const img = document.createElement("img");
          img.src = asset(p.image);
          img.alt = "";
          img.style.cssText = "width:100%;height:90px;object-fit:cover;border-radius:10px;margin-bottom:6px";
          wrap.appendChild(img);
        }
        const a = document.createElement("a");
        a.href = asset(p.href);
        a.textContent = p.title; // textContent: never inject user HTML into the map
        a.style.cssText = "font-weight:700;color:#0c3520;display:block";
        wrap.appendChild(a);
        if (p.subtitle) {
          const s = document.createElement("div");
          s.textContent = p.subtitle;
          s.style.cssText = "font-size:12px;color:#4c5b50";
          wrap.appendChild(s);
        }
        L.marker([p.lat, p.lng], { icon, title: p.title }).addTo(map).bindPopup(wrap);
        bounds.push([p.lat, p.lng]);
      }
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points]);
  return <div ref={el} style={{ height }} className="w-full overflow-hidden rounded-[18px] border border-line bg-sand" role="region" aria-label="Map" />;
}
