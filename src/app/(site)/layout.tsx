import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getSettings } from "@/server/settings";
import { Assistant } from "@/components/Assistant";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <>
      {settings.announcement && (
        <div className="bg-ink px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
          <span className="mr-2 inline-block rounded-full bg-highlight px-2 py-0.5 text-[11px] font-bold text-ink">NEW</span>
          {settings.announcement}
        </div>
      )}
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
      <Assistant />
    </>
  );
}
