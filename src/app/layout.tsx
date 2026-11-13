import type { Metadata, Viewport } from "next";
import { Archivo, Newsreader } from "next/font/google";
import { PwaRegister } from "@/components/layout/PwaRegister";
import "./globals.css";

// Same typefaces as griscanada.org
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], display: "swap", weight: ["400", "500", "600", "700", "800", "900"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], display: "swap", style: ["italic"], weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "AGRI HUB — BC's agri-food marketplace & ecosystem | GRIS Canada", template: "%s · AGRI HUB" },
  description:
    "AGRI HUB connects BC growers, buyers, universities, financing partners, government programs and ag-tech in one place. List produce, find local supply, send RFQs and access funding — by GRIS Canada.",
  applicationName: "AGRI HUB",
  openGraph: { type: "website", siteName: "AGRI HUB by GRIS Canada", images: ["/brand/GRIS_Logo_Badge.png"] },
  appleWebApp: { capable: true, title: "AGRI HUB", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0C3520",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-CA" data-scroll-behavior="smooth" className={`${archivo.variable} ${newsreader.variable}`}>
      <body className="min-h-dvh font-sans text-[16px] sm:text-[17px]">
        <a href="#main" className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          Skip to content
        </a>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
