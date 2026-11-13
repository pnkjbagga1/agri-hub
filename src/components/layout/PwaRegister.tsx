"use client";
import { useEffect } from "react";
import { asset, BASE_PATH } from "@/lib/paths";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(asset("/sw.js"), { scope: (BASE_PATH || "") + "/" }).catch(() => {});
    }
  }, []);
  return null;
}
