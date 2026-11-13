import type { Metadata } from "next";
import Image from "next/image";
import { ButtonLink } from "@/components/ui";
import { asset } from "@/lib/paths";

export const metadata: Metadata = { title: "About AGRI HUB", description: "AGRI HUB is GRIS Canada's non-profit sector-development and connection platform for BC's agri-food ecosystem." };

export default function AboutPage() {
  return (
    <div>
      <section className="bg-primary text-white">
        <div className="container-page grid items-center gap-10 py-16 lg:grid-cols-[1.3fr_.7fr]">
          <div>
            <p className="eyebrow">About the Agri Hub</p>
            <h1 className="mt-3 text-4xl text-white sm:text-5xl">
              A farm should not have to build its network <span className="accent text-gold-soft">from scratch every season.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-white/80">
              AGRI HUB is the digital front door of GRIS Canada — the Green Revolution Innovation Society. It provides information services, directories and digital tools that connect BC&apos;s agricultural community, for the benefit of the sector as a whole.
            </p>
          </div>
          <Image src={asset("/brand/GRIS_Logo_Badge.png")} alt="GRIS Canada — Empowering Farmers, Feeding the Future" width={260} height={265} className="mx-auto" />
        </div>
      </section>
      <div className="container-page max-w-4xl space-y-12 py-14">
        <section>
          <h2 className="text-3xl">Why we built it</h2>
          <p className="mt-4 leading-relaxed text-ink-soft">
            BC imports 77.1% of its fresh vegetables. GRIS Canada is building a networked agri-hub centred in Abbotsford — Farmer Support Units, an Innovation & Tech Center, a Processing & Value-Add Hub, a Market & Export Center and an Incubator/Accelerator — drawing on proven models from the Netherlands, India, Israel and Spain. The physical hub takes time; AGRI HUB launches first so growers, buyers and partners can connect today, prove demand, and form the community that will fill the hub.
          </p>
        </section>
        <section>
          <h2 className="text-3xl">How we work</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              ["Non-profit", "AGRI HUB takes no commission on deals between members. Growers and buyers transact directly."],
              ["Verified", "GRIS Canada reviews listings, verifies organisations and checks certification documents."],
              ["Built to scale", "Regions are configuration, not code — ready for every province and international partners."],
            ].map(([t, b]) => (
              <li key={t} className="card p-5">
                <p className="font-bold">{t}</p>
                <p className="mt-1 text-sm text-muted">{b}</p>
              </li>
            ))}
          </ul>
        </section>
        <section id="privacy" className="scroll-mt-24">
          <h2 className="text-3xl">Privacy notice</h2>
          <div className="mt-4 space-y-3 leading-relaxed text-ink-soft">
            <p>We collect the information you provide (account, profile, listings, messages) to operate AGRI HUB, in line with BC&apos;s Personal Information Protection Act (PIPA). Your address and private phone are never shown publicly; public email and phone are only visible to signed-in members.</p>
            <p>Passwords are hashed with Argon2id; sessions use signed, HTTP-only cookies; admin accounts support two-factor authentication. We do not sell personal information. Email privacy@griscanada.org to access, correct or delete your data.</p>
          </div>
        </section>
        <section id="terms" className="scroll-mt-24">
          <h2 className="text-3xl">Terms of use (summary)</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-ink-soft">
            <li>List only products you can lawfully supply, with accurate descriptions, photos and certifications.</li>
            <li>Agreements and payments are between members; GRIS Canada is not a party to transactions.</li>
            <li>No spam, harassment or misleading content. Moderators may remove content or suspend accounts.</li>
            <li>Directory entries marked “Unclaimed” are compiled from public information and can be claimed by the organisation.</li>
          </ul>
        </section>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/signup" variant="gold" size="lg">
            Join the Agri Hub
          </ButtonLink>
          <ButtonLink href="https://griscanada.org/" variant="outline" size="lg">
            Visit griscanada.org
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
