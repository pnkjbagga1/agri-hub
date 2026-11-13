"use client";
import dynamic from "next/dynamic";
import type { MapPoint } from "./MapView";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="h-[520px] animate-pulse rounded-[18px] bg-sand" /> });

export function MapLoader(props: { points: MapPoint[]; height?: number }) {
  return <MapView {...props} />;
}
