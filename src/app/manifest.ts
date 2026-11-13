import type { MetadataRoute } from "next";
import { asset } from "@/lib/paths";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AGRI HUB by GRIS Canada",
    short_name: "AGRI HUB",
    description: "BC's agri-food marketplace and stakeholder ecosystem.",
    start_url: asset("/dashboard"),
    scope: asset("/"),
    display: "standalone",
    background_color: "#F7F5EE",
    theme_color: "#0B5A14",
    icons: [
      { src: asset("/brand/GRIS_Logo_Badge.png"), sizes: "227x231", type: "image/png", purpose: "any" },
    ],
    categories: ["business", "food", "productivity"],
  };
}
