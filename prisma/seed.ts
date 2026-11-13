/* AGRI HUB seed — real BC / Abbotsford context from the GRIS Canada reports.
 * Run: npm run db:seed   (wipes and recreates demo data)
 *
 * DEMO ACCOUNTS (local/dev only — every account uses the password in DEMO_PASSWORD below)
 *   Admin portal  (/admin/login)    admin@agrihub.test
 *   Member portal (/login)          grower@agrihub.test  (Sumas Prairie Berry Co., Abbotsford)
 *                                   buyer@agrihub.test   (Coast Fresh Grocers, Vancouver)
 *   Partner portal(/partners/login) partner@agrihub.test (Fraser Valley Agri Consulting)
 *                                   agtech@agrihub.test  (GreenGrow AgTech Solutions)
 * Real organisations (UBC, KPU, EDC, FCC, BC Ministry, AAFC) are seeded as UNCLAIMED
 * directory entries compiled from public information — they have no login.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { writePlaceholders } from "./placeholders";

export const DEMO_PASSWORD = "AgriHub-Demo-2026";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const day = 86400000;
const now = Date.now();
const d = (offsetDays: number) => new Date(now + offsetDays * day);
const lot = (n: number) => `AH-FV-${String(2600 + n).padStart(5, "0")}`;

async function wipe() {
  // order matters for FK constraints
  const tables = [
    "ActivityEvent", "AuditLog", "Notification", "EmailOutbox", "Token", "Upload", "Report", "Review", "Reaction", "Comment", "Post", "Space",
    "EventRsvp", "Event", "ResourceInterest", "Resource", "DemandPost", "Rfq", "Message", "ThreadParticipant", "Thread", "SavedSearch", "Favorite",
    "Listing", "CertificationDoc", "Profile", "User", "Region", "KpiTarget", "SiteSetting",
  ];
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

async function main() {
  await wipe();
  const passwordHash = await hash(DEMO_PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });

  /* ---------------- Regions (Action Plan §3 regional produce map) ---------------- */
  const regionData = [
    { slug: "fraser-valley", name: "Fraser Valley", description: "Lower Mainland / Fraser Valley incl. Abbotsford — the primary GRIS Canada hub and BC's highest farm-gate density.", specialties: ["berries", "greenhouse vegetables", "dairy", "poultry", "nursery"], lat: 49.0504, lng: -122.3045, sortOrder: 1 },
    { slug: "vancouver-island", name: "Vancouver Island", description: "Satellite Farmer Support Unit; direct-to-urban Victoria/Nanaimo market.", specialties: ["dairy", "berries", "market garden"], lat: 48.7787, lng: -123.7079, sortOrder: 2 },
    { slug: "thompson-okanagan", name: "Thompson-Okanagan", description: "Satellite node; strong fit for tree-fruit processing & export.", specialties: ["tree fruit", "wine grapes", "field vegetables"], lat: 49.888, lng: -119.496, sortOrder: 3 },
    { slug: "kootenays", name: "Kootenays", description: "Niche / organic supply channel into the marketplace.", specialties: ["small-scale", "organic"], lat: 49.0955, lng: -116.5135, sortOrder: 4 },
    { slug: "cariboo", name: "Cariboo / Central Interior", description: "Longer-term expansion candidate.", specialties: ["forage", "ranching", "field vegetables"], lat: 52.1417, lng: -122.1417, sortOrder: 5, isActive: false },
    { slug: "peace-river", name: "Peace River / Northeast", description: "Grain, oilseed and forage — not a near-term fresh-produce priority.", specialties: ["grain", "oilseed"], lat: 56.2465, lng: -120.8476, sortOrder: 6, isActive: false },
  ];
  const regions: Record<string, { id: string; lat: number; lng: number }> = {};
  for (const r of regionData) {
    const row = await db.region.create({ data: r });
    regions[r.slug] = { id: row.id, lat: r.lat, lng: r.lng };
  }

  /* ---------------- Placeholder art ---------------- */
  const produceArt = [
    ["blueberries", "Blueberries"], ["raspberries", "Raspberries"], ["strawberries", "Strawberries"], ["tomatoes", "Tomatoes"], ["peppers", "Bell Peppers"],
    ["cucumbers", "Cucumbers"], ["apples", "Apples"], ["cherries", "Cherries"], ["greens", "Salad Greens"], ["herbs", "Fresh Herbs"], ["potatoes", "Potatoes"],
    ["eggs", "Free-range Eggs"], ["dairy", "Dairy"], ["honey", "Honey"], ["nursery", "Nursery Stock"], ["grapes", "Grapes"], ["corn", "Sweet Corn"],
  ] as const;
  const produceFiles = produceArt.flatMap(([kind, label]) => [1, 2].map((v) => ({ file: `${kind}-${v}.svg`, kind, label })));

  /* ---------------- Accounts ---------------- */
  type Seed = {
    email?: string; role: Prisma.UserCreateInput["role"]; org: string; contact?: string; region: string; city: string; tagline: string; bio: string;
    certs?: string[]; specialties?: string[]; buyerType?: string; website?: string; verified?: boolean; claimed?: boolean; featured?: boolean; acres?: number; jitter?: number;
  };
  const people: Seed[] = [
    // Growers — Fraser Valley / Abbotsford focus (fictional sample farms)
    { email: "grower@agrihub.test", role: "grower", org: "Sumas Prairie Berry Co.", contact: "Harpreet Sandhu", region: "fraser-valley", city: "Abbotsford", tagline: "Third-generation blueberry & raspberry growers on Sumas Prairie", bio: "We farm 64 acres of highbush blueberries and floricane raspberries on Sumas Prairie. Hand- and machine-picked, pre-cooled within 2 hours of harvest. Supplying Lower Mainland retailers and processors since 1987.", certs: ["buy_bc", "canadagap"], specialties: ["blueberries", "raspberries"], verified: true, featured: true, acres: 64 },
    { role: "grower", org: "Matsqui Valley Blueberries", contact: "Daniel Friesen", region: "fraser-valley", city: "Abbotsford", tagline: "Duke, Bluecrop & Elliott blueberries — fresh and IQF", bio: "Family blueberry farm on the Matsqui flats with on-farm cold storage and IQF partner capacity for processors.", certs: ["organic", "buy_bc"], specialties: ["blueberries"], verified: true, acres: 40 },
    { role: "grower", org: "Bradner Road Greenhouses", contact: "Maria Vos", region: "fraser-valley", city: "Abbotsford", tagline: "Year-round greenhouse tomatoes & mini cucumbers", bio: "12 acres under glass with LED inter-lighting and closed-loop irrigation. Year-round tomatoes on the vine, cocktail tomatoes and mini cucumbers.", certs: ["canadagap", "buy_bc"], specialties: ["greenhouse", "tomatoes", "cucumbers"], verified: true, featured: true, acres: 12 },
    { role: "grower", org: "Mount Lehman Organics", contact: "Aisha Rahman", region: "fraser-valley", city: "Abbotsford", tagline: "Certified organic market garden & salad greens", bio: "Certified organic mixed vegetables, salad greens and herbs for restaurants and box programs. CSA pickup at the farm on Saturdays.", certs: ["organic"], specialties: ["salad greens", "herbs", "market garden"], acres: 9 },
    { role: "grower", org: "Huntingdon Fresh Greenhouse", contact: "Gurpreet Gill", region: "fraser-valley", city: "Abbotsford", tagline: "Bell peppers in four colours, minutes from the Sumas border crossing", bio: "Greenhouse bell peppers (red, yellow, orange, green) packed to retail spec. Export-ready paperwork for US buyers.", certs: ["canadagap", "buy_bc", "haccp"], specialties: ["peppers", "greenhouse", "export"], verified: true, acres: 18 },
    { role: "grower", org: "Aldergrove Raspberry Ranch", contact: "Tom Kowalski", region: "fraser-valley", city: "Aldergrove", tagline: "Processing-grade raspberries by the tonne", bio: "Machine-harvested processing raspberries in bulk totes, plus fresh flats for farm markets.", certs: ["buy_bc"], specialties: ["raspberries", "processing"], acres: 55 },
    { role: "grower", org: "Fraser Crest Potatoes", contact: "Jasdeep Dhaliwal", region: "fraser-valley", city: "Chilliwack", tagline: "Early potatoes and sweet corn from the eastern Fraser Valley", bio: "Fraser Valley early potatoes (Warba, Yukon Gold) and bi-colour sweet corn. Washed and graded on farm.", certs: ["canadagap"], specialties: ["potatoes", "sweet corn"], acres: 120 },
    { role: "grower", org: "Clayburn Free-Range Eggs", contact: "Lena Martens", region: "fraser-valley", city: "Abbotsford", tagline: "SPCA-certified free-range eggs & wildflower honey", bio: "4,000-hen free-range flock and 60 hives. Weekly egg deliveries across Abbotsford and Langley.", certs: ["buy_bc"], specialties: ["eggs", "honey"], acres: 15 },
    { role: "grower", org: "Kelowna Ridge Orchards", contact: "Peter Lindqvist", region: "thompson-okanagan", city: "Kelowna", tagline: "Ambrosia, Gala & Lapins cherries from the Okanagan benches", bio: "Tree-fruit orchard with controlled-atmosphere storage. Apples available through spring; cherries July–August.", certs: ["buy_bc", "canadagap"], specialties: ["apples", "cherries", "tree fruit"], verified: true, acres: 80 },
    { role: "grower", org: "Cowichan Market Garden", contact: "Sarah Thompson", region: "vancouver-island", city: "Duncan", tagline: "Island strawberries, greens and herbs", bio: "Small-scale diversified farm supplying Victoria restaurants and markets.", certs: ["organic"], specialties: ["strawberries", "greens"], acres: 7 },
    { role: "grower", org: "Creston Valley Organics", contact: "Noah Blackwood", region: "kootenays", city: "Creston", tagline: "Organic orchard & nursery stock from the Kootenays", bio: "Certified organic cherries, apples and fruit-tree nursery stock.", certs: ["organic"], specialties: ["nursery", "cherries", "organic"], acres: 22 },
    // Buyers (fictional)
    { email: "buyer@agrihub.test", role: "buyer", org: "Coast Fresh Grocers", contact: "Emily Chen", region: "fraser-valley", city: "Vancouver", tagline: "Independent grocery group — 14 stores across Metro Vancouver", bio: "We prioritise BC-grown produce and run a Buy BC endcap program all season. Looking for consistent weekly supply of berries and greenhouse veg.", buyerType: "retail", verified: true, jitter: 0.5 },
    { role: "buyer", org: "Harbour Table Restaurant Group", contact: "Marco Rossi", region: "fraser-valley", city: "Vancouver", tagline: "Farm-to-table restaurants in Vancouver & Victoria", bio: "Six restaurants sourcing seasonal produce direct from growers.", buyerType: "food_service", jitter: 0.6 },
    { role: "buyer", org: "Valley Pack Processors", contact: "Raj Grewal", region: "fraser-valley", city: "Abbotsford", tagline: "IQF berries, purées and juice concentrate", bio: "Processing plant buying blueberries and raspberries in tote volumes every summer.", buyerType: "processor", verified: true },
    { role: "buyer", org: "Pacific Gateway Exports", contact: "Linh Nguyen", region: "fraser-valley", city: "Richmond", tagline: "Exporting BC berries and cherries to Asia-Pacific", bio: "Export distributor with cold-chain consolidation near YVR. Working with EDC on credit insurance.", buyerType: "export", jitter: 0.4 },
    { role: "buyer", org: "Okanagan Market Co-op", contact: "Claire Dubois", region: "thompson-okanagan", city: "Vernon", tagline: "Member-owned grocery co-op", bio: "Local food co-op serving the North Okanagan.", buyerType: "retail" },
    // Partners — real organisations as UNCLAIMED entries (public info only)
    { role: "university", org: "UBC Faculty of Land and Food Systems", region: "fraser-valley", city: "Vancouver", tagline: "Teaching, research and the UBC Farm living lab", bio: "Directory entry compiled by GRIS Canada from public information. UBC's Faculty of Land and Food Systems works on food security, sustainable agriculture and applied research, including the UBC Farm.", website: "https://landfood.ubc.ca", claimed: false, specialties: ["research", "food security", "education"] },
    { role: "university", org: "Kwantlen Polytechnic University — Sustainable Agriculture", region: "fraser-valley", city: "Richmond", tagline: "Sustainable agriculture & food systems education", bio: "Directory entry compiled by GRIS Canada from public information. KPU offers sustainable agriculture and food-systems programs and applied research for small and mid-scale farms.", website: "https://www.kpu.ca", claimed: false, specialties: ["education", "applied research"] },
    { role: "edc", org: "Export Development Canada", region: "fraser-valley", city: "Vancouver", tagline: "Export financing, credit insurance and buyer connections", bio: "Directory entry compiled by GRIS Canada from public information. EDC is Canada's export credit agency and supports agri-food exporters with financing, insurance and market connections.", website: "https://www.edc.ca/en/who-we-support/sectors/agri-food.html", claimed: false, specialties: ["export", "credit insurance"] },
    { role: "fcc", org: "Farm Credit Canada", region: "fraser-valley", city: "Abbotsford", tagline: "Canada's agriculture and agri-food lender", bio: "Directory entry compiled by GRIS Canada from public information. FCC provides financing, knowledge and software to Canadian producers and agri-food businesses.", website: "https://www.fcc-fac.ca", claimed: false, specialties: ["loans", "young farmers"] },
    { role: "bc_gov", org: "BC Ministry of Agriculture and Food", region: "fraser-valley", city: "Victoria", tagline: "Provincial programs, Buy BC and food security", bio: "Directory entry compiled by GRIS Canada from public information. The Ministry delivers provincial agriculture programs including Buy BC and business-development supports.", website: "https://www2.gov.bc.ca/gov/content/industry/agriculture-seafood", claimed: false, specialties: ["grants", "buy bc"] },
    { role: "fed_gov", org: "AAFC — Agassiz Research and Development Centre", region: "fraser-valley", city: "Agassiz", tagline: "Federal agricultural research in the Fraser Valley", bio: "Directory entry compiled by GRIS Canada from public information. Agriculture and Agri-Food Canada research centre focused on berries, dairy and sustainable production in the Fraser Valley.", website: "https://agriculture.canada.ca", claimed: false, specialties: ["research", "berries", "dairy"] },
    // Partners — fictional companies with logins
    { email: "partner@agrihub.test", role: "consultant", org: "Fraser Valley Agri Consulting", contact: "Navdeep Bains", region: "fraser-valley", city: "Abbotsford", tagline: "Farm business plans, food-safety audits and grant applications", bio: "Agrologists and food-safety specialists helping growers with CanadaGAP prep, business plans and funding applications.", verified: true, specialties: ["canadagap", "business planning", "grants"] },
    { email: "agtech@agrihub.test", role: "agtech", org: "GreenGrow AgTech Solutions", contact: "Olivia Park", region: "fraser-valley", city: "Langley", tagline: "Climate sensors & irrigation automation for berry and greenhouse growers", bio: "Wireless soil-moisture and canopy sensors with an irrigation controller. Free 60-day on-farm trials for Fraser Valley growers.", verified: true, featured: true, specialties: ["sensors", "irrigation", "greenhouse"] },
    { role: "financing", org: "Valley Equipment Leasing", contact: "Brent Harder", region: "fraser-valley", city: "Abbotsford", tagline: "Lease-to-own for harvesters, tractors and greenhouse systems", bio: "Equipment lease-to-own with seasonal payment schedules matched to harvest cash flow.", specialties: ["leasing", "equipment"] },
    { role: "sales_marketing", org: "Harvest Story Marketing", contact: "Priya Patel", region: "fraser-valley", city: "Langley", tagline: "Branding, packaging and retail pitch decks for growers", bio: "We help farms tell their story on pack and land listings with grocery buyers.", specialties: ["branding", "packaging"] },
  ];

  const avatarFiles: { file: string; initials: string; role: string }[] = [];
  const users: Record<string, { id: string; profileId: string; role: string; org: string; regionSlug: string; certs: string[] }> = {};
  let idx = 0;
  for (const p of people) {
    idx++;
    const slugBase = p.org.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    const initials = p.org.replace(/[—-].*$/, "").split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("");
    const avatar = `avatar-${slugBase}.svg`;
    avatarFiles.push({ file: avatar, initials, role: p.role });
    const reg = regions[p.region]!;
    const jitter = p.jitter ?? 0.12;
    const email = p.email ?? (p.claimed === false ? `unclaimed+${slugBase}@agrihub.invalid` : `${slugBase.slice(0, 30)}@agrihub.test`);
    const u = await db.user.create({
      data: {
        email,
        passwordHash,
        role: p.role,
        emailVerifiedAt: new Date(),
        isVerified: p.verified ?? false,
        createdAt: d(-120 + idx * 3),
        profile: {
          create: {
            slug: slugBase,
            orgName: p.org,
            contactName: p.contact,
            tagline: p.tagline,
            bio: p.bio,
            photoUrl: `/seed/${avatar}`,
            coverUrl: `/seed/cover-${(idx % 4) + 1}.svg`,
            website: p.website,
            publicEmail: p.claimed === false ? null : email,
            city: p.city,
            regionId: reg.id,
            lat: reg.lat + (Math.sin(idx * 7.1) * jitter) / 2,
            lng: reg.lng + (Math.cos(idx * 3.7) * jitter) / 1.2,
            certifications: p.certs ?? [],
            specialties: p.specialties ?? [],
            buyerType: p.buyerType,
            farmSizeAcres: p.acres,
            approval: "approved",
            isFeatured: p.featured ?? false,
            isClaimed: p.claimed ?? true,
            views: 40 + ((idx * 37) % 300),
          },
        },
      },
      include: { profile: true },
    });
    users[p.org] = { id: u.id, profileId: u.profile!.id, role: p.role, org: p.org, regionSlug: p.region, certs: p.certs ?? [] };
  }

  const admin = await db.user.create({ data: { email: "admin@agrihub.test", passwordHash, role: "admin", emailVerifiedAt: new Date(), isVerified: true } });

  writePlaceholders(produceFiles, avatarFiles);

  /* ---------------- Listings ---------------- */
  type L = { grower: string; title: string; produce: string; variety?: string; category: Prisma.ListingCreateInput["category"]; art: string; volume: number; unit: string; price?: number; priceUnit?: string; pricing?: string; start?: number; end?: number; desc: string; delivery?: string[]; minOrder?: number; featured?: boolean; status?: Prisma.ListingCreateInput["status"]; approval?: Prisma.ListingCreateInput["approval"] };
  const listings: L[] = [
    { grower: "Sumas Prairie Berry Co.", title: "Highbush Blueberries — 2027 Harvest (Pre-order)", produce: "Blueberries", variety: "Duke & Bluecrop", category: "berries", art: "blueberries", volume: 20000, unit: "kg", price: 4.2, priceUnit: "kg", pricing: "negotiable", start: 235, end: 290, desc: "Fresh-pack highbush blueberries in 12 × 1 pint flats or bulk. Pre-cooled within 2 hours. Pre-book 2027 volume now for guaranteed allocation.", delivery: ["pickup", "delivery"], minOrder: 500, featured: true },
    { grower: "Sumas Prairie Berry Co.", title: "Frozen Blueberries (IQF) — 2026 Crop", produce: "Blueberries", variety: "Bluecrop", category: "berries", art: "blueberries", volume: 8000, unit: "kg", price: 3.6, priceUnit: "kg", pricing: "fixed", desc: "IQF blueberries from the 2026 crop, 10 kg cases, stored at -18°C in Abbotsford.", delivery: ["pickup", "shipping"], minOrder: 100 },
    { grower: "Sumas Prairie Berry Co.", title: "Floricane Raspberries — Fresh Flats", produce: "Raspberries", variety: "Chemainus", category: "berries", art: "raspberries", volume: 3000, unit: "kg", price: 9.5, priceUnit: "kg", start: 225, end: 260, desc: "Hand-picked Chemainus raspberries in 12 × 6 oz clamshell flats.", delivery: ["pickup", "delivery"] },
    { grower: "Matsqui Valley Blueberries", title: "Certified Organic Blueberries", produce: "Blueberries", variety: "Elliott", category: "berries", art: "blueberries", volume: 6000, unit: "kg", price: 6.8, priceUnit: "kg", pricing: "negotiable", start: 250, end: 300, desc: "Certified organic late-season Elliott blueberries. Ideal for retail organic programs.", delivery: ["pickup", "delivery"], featured: true },
    { grower: "Bradner Road Greenhouses", title: "Tomatoes on the Vine — Year-round", produce: "Tomatoes", variety: "TOV", category: "vegetable", art: "tomatoes", volume: 4500, unit: "kg", price: 3.9, priceUnit: "kg", pricing: "fixed", start: -30, end: 330, desc: "LED inter-lit greenhouse TOV, packed in 15 lb cases. Weekly standing orders available.", delivery: ["delivery", "shipping"], minOrder: 200, featured: true },
    { grower: "Bradner Road Greenhouses", title: "Mini Cucumbers — 6 lb cases", produce: "Cucumbers", variety: "Mini", category: "vegetable", art: "cucumbers", volume: 2500, unit: "case", price: 14.5, priceUnit: "case", start: -60, end: 300, desc: "Seedless mini cucumbers, 6 lb cases. Consistent weekly volume through winter.", delivery: ["delivery"] },
    { grower: "Bradner Road Greenhouses", title: "Cocktail Tomatoes", produce: "Tomatoes", variety: "Campari-type", category: "vegetable", art: "tomatoes", volume: 1800, unit: "kg", price: 5.2, priceUnit: "kg", desc: "Sweet cocktail tomatoes, 1 lb clamshells or bulk.", delivery: ["delivery"] },
    { grower: "Mount Lehman Organics", title: "Organic Salad Mix", produce: "Salad Greens", variety: "Spring mix", category: "vegetable", art: "greens", volume: 400, unit: "kg", price: 18, priceUnit: "kg", start: -10, end: 40, desc: "Certified organic baby greens, triple-washed, 2 lb restaurant bags.", delivery: ["pickup", "delivery"] },
    { grower: "Mount Lehman Organics", title: "Organic Basil & Cilantro", produce: "Fresh Herbs", category: "herbs", art: "herbs", volume: 120, unit: "kg", price: 22, priceUnit: "kg", desc: "Bunched or bulk organic herbs from our heated hoop houses.", delivery: ["pickup", "delivery"] },
    { grower: "Huntingdon Fresh Greenhouse", title: "Greenhouse Bell Peppers — Red, Yellow, Orange", produce: "Bell Peppers", category: "vegetable", art: "peppers", volume: 9000, unit: "kg", price: 4.6, priceUnit: "kg", pricing: "negotiable", start: -45, end: 120, desc: "Retail-spec bell peppers, 5 kg cases. Export documentation ready for US buyers via the Sumas crossing.", delivery: ["delivery", "shipping"], minOrder: 300, featured: true },
    { grower: "Aldergrove Raspberry Ranch", title: "Processing Raspberries — Bulk Totes", produce: "Raspberries", variety: "Wakefield", category: "berries", art: "raspberries", volume: 45, unit: "tonne", pricing: "rfq", start: 220, end: 265, desc: "Machine-harvested processing raspberries delivered in 400 kg totes. Contract pricing for 2027.", delivery: ["delivery"] },
    { grower: "Fraser Crest Potatoes", title: "Yukon Gold Potatoes — Storage", produce: "Potatoes", variety: "Yukon Gold", category: "vegetable", art: "potatoes", volume: 30, unit: "tonne", price: 0.95, priceUnit: "kg", desc: "Washed and graded Yukon Gold from cold storage, 50 lb sacks.", delivery: ["pickup", "delivery"] },
    { grower: "Fraser Crest Potatoes", title: "Bi-colour Sweet Corn — 2027 Season", produce: "Sweet Corn", category: "vegetable", art: "corn", volume: 60000, unit: "dozen", price: 4.5, priceUnit: "dozen", start: 245, end: 285, desc: "Fraser Valley sweet corn, picked daily in season. Pre-book for summer promotions.", delivery: ["pickup", "delivery"] },
    { grower: "Clayburn Free-Range Eggs", title: "Free-range Large Brown Eggs", produce: "Eggs", category: "poultry_eggs", art: "eggs", volume: 900, unit: "dozen", price: 6.5, priceUnit: "dozen", desc: "Weekly supply of graded large brown eggs, 15-dozen cases.", delivery: ["delivery"] },
    { grower: "Clayburn Free-Range Eggs", title: "Raw Wildflower Honey", produce: "Honey", category: "value_added", art: "honey", volume: 600, unit: "kg", price: 14, priceUnit: "kg", desc: "Raw Fraser Valley wildflower honey in 500 g jars or 25 kg pails.", delivery: ["pickup", "shipping"] },
    { grower: "Kelowna Ridge Orchards", title: "Ambrosia Apples — CA Storage", produce: "Apples", variety: "Ambrosia", category: "fruit", art: "apples", volume: 40, unit: "tonne", price: 1.9, priceUnit: "kg", pricing: "negotiable", desc: "Controlled-atmosphere stored Ambrosia apples available through April. 40 lb cartons.", delivery: ["shipping"], featured: true },
    { grower: "Kelowna Ridge Orchards", title: "Lapins Cherries — 2027 Export Grade", produce: "Cherries", variety: "Lapins", category: "fruit", art: "cherries", volume: 15, unit: "tonne", pricing: "rfq", start: 250, end: 280, desc: "Export-grade 10-row Lapins cherries. Seeking export partners for 2027.", delivery: ["shipping"] },
    { grower: "Cowichan Market Garden", title: "Island Strawberries", produce: "Strawberries", variety: "Albion", category: "berries", art: "strawberries", volume: 800, unit: "flat", price: 32, priceUnit: "flat", start: 200, end: 300, desc: "Day-neutral Albion strawberries for Victoria restaurants and markets.", delivery: ["delivery"] },
    { grower: "Creston Valley Organics", title: "Organic Fruit-Tree Nursery Stock", produce: "Nursery Stock", category: "nursery", art: "nursery", volume: 1500, unit: "plant", price: 28, priceUnit: "plant", start: 120, end: 180, desc: "Certified organic bare-root apple and cherry trees for spring planting.", delivery: ["shipping", "pickup"] },
    { grower: "Aldergrove Raspberry Ranch", title: "Raspberry Purée (Draft)", produce: "Raspberries", category: "value_added", art: "raspberries", volume: 2000, unit: "kg", price: 7, priceUnit: "kg", desc: "Seedless raspberry purée — draft listing.", status: "draft" },
    { grower: "Huntingdon Fresh Greenhouse", title: "Hot Peppers Mix", produce: "Peppers", category: "vegetable", art: "peppers", volume: 300, unit: "kg", price: 8, priceUnit: "kg", desc: "Jalapeño, Fresno and habanero mix.", approval: "pending" },
  ];
  const listingIds: Record<string, string> = {};
  let n = 0;
  for (const l of listings) {
    n++;
    const g = users[l.grower]!;
    const reg = regions[g.regionSlug]!;
    const row = await db.listing.create({
      data: {
        slug: `${l.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50)}-${n}`,
        growerId: g.id,
        title: l.title,
        produce: l.produce,
        variety: l.variety,
        category: l.category,
        description: l.desc,
        volume: l.volume,
        unit: l.unit,
        minOrder: l.minOrder,
        price: l.price,
        priceUnit: l.priceUnit,
        pricingMethod: l.pricing ?? "fixed",
        harvestStart: l.start != null ? d(l.start) : null,
        harvestEnd: l.end != null ? d(l.end) : null,
        deliveryOptions: l.delivery ?? ["pickup"],
        deliveryArea: "Lower Mainland & Fraser Valley",
        pickupLocation: `${g.org}, ${people.find((p) => p.org === l.grower)!.city}, BC`,
        regionId: reg.id,
        lat: reg.lat + Math.sin(n) * 0.08,
        lng: reg.lng + Math.cos(n) * 0.12,
        photos: [`/seed/${l.art}-1.svg`, `/seed/${l.art}-2.svg`],
        certifications: g.certs,
        status: l.status ?? "active",
        approval: l.approval ?? "approved",
        lotCode: lot(n),
        isFeatured: l.featured ?? false,
        views: 30 + ((n * 53) % 400),
        createdAt: d(-60 + n * 2),
      },
    });
    listingIds[l.title] = row.id;
  }

  /* ---------------- Messaging, RFQs (incl. one accepted = informal transaction) ---------------- */
  const buyer = users["Coast Fresh Grocers"]!;
  const grower = users["Sumas Prairie Berry Co."]!;
  async function thread(listingTitle: string, a: string, b: string, msgs: [string, string, number][]) {
    const t = await db.thread.create({
      data: {
        listingId: listingIds[listingTitle],
        subject: listingTitle,
        createdAt: d(msgs[0]![2]),
        participants: { create: [{ userId: users[a]!.id, lastReadAt: d(0) }, { userId: users[b]!.id, lastReadAt: d(msgs.at(-2)?.[2] ?? -1) }] },
        messages: { create: msgs.map(([who, body, at]) => ({ senderId: users[who]!.id, body, createdAt: d(at) })) },
      },
    });
    return t.id;
  }
  const t1 = await thread("Highbush Blueberries — 2027 Harvest (Pre-order)", "Coast Fresh Grocers", "Sumas Prairie Berry Co.", [
    ["Coast Fresh Grocers", "Hi! We're planning our 2027 Buy BC berry program — interested in 2,000 kg/week of fresh blueberries for 6 weeks. Can you confirm delivery to our Vancouver DC?", -6],
    ["Sumas Prairie Berry Co.", "Yes, we deliver to Vancouver twice a week in season with our reefer truck. I've sent a quote through the RFQ.", -5],
    ["Coast Fresh Grocers", "Great, reviewing with our produce manager this week.", -4],
  ]);
  await db.rfq.create({ data: { buyerId: buyer.id, growerId: grower.id, listingId: listingIds["Highbush Blueberries — 2027 Harvest (Pre-order)"], threadId: t1, quantity: 12000, unit: "kg", deliveryDate: d(240), targetPrice: 3.9, notes: "6 weekly deliveries of 2,000 kg to Vancouver DC.", status: "quoted", quotePrice: 4.05, quoteNotes: "Price includes delivery; 50% volume locked by March.", respondedAt: d(-5), createdAt: d(-6) } });
  await db.message.create({ data: { threadId: t1, senderId: buyer.id, body: "RFQ: 12,000 kg @ target $3.90/kg, delivery from July 2027", kind: "rfq", createdAt: d(-6) } });
  await db.message.create({ data: { threadId: t1, senderId: grower.id, body: "Quote: $4.05/kg incl. delivery", kind: "quote", createdAt: d(-5) } });

  const t2 = await thread("Tomatoes on the Vine — Year-round", "Harbour Table Restaurant Group", "Bradner Road Greenhouses", [
    ["Harbour Table Restaurant Group", "Could you supply 150 kg TOV weekly to our two Vancouver kitchens?", -20],
    ["Bradner Road Greenhouses", "Absolutely — Tuesday deliveries work. Quote attached via RFQ.", -19],
    ["Harbour Table Restaurant Group", "Accepted — let's start next week!", -17],
  ]);
  await db.rfq.create({ data: { buyerId: users["Harbour Table Restaurant Group"]!.id, growerId: users["Bradner Road Greenhouses"]!.id, listingId: listingIds["Tomatoes on the Vine — Year-round"], threadId: t2, quantity: 150, unit: "kg", targetPrice: 3.8, status: "accepted", quotePrice: 3.85, respondedAt: d(-19), closedAt: d(-17), createdAt: d(-20) } });

  const t3 = await thread("Processing Raspberries — Bulk Totes", "Valley Pack Processors", "Aldergrove Raspberry Ranch", [["Valley Pack Processors", "We'd like to contract 30 tonnes for 2027 — open to discussing price per pound?", -3]]);
  await db.rfq.create({ data: { buyerId: users["Valley Pack Processors"]!.id, growerId: users["Aldergrove Raspberry Ranch"]!.id, listingId: listingIds["Processing Raspberries — Bulk Totes"], threadId: t3, quantity: 30, unit: "tonne", deliveryDate: d(230), notes: "Contract for 2027 season.", createdAt: d(-3) } });

  /* ---------------- Reviews ---------------- */
  await db.review.create({ data: { authorId: users["Harbour Table Restaurant Group"]!.id, subjectId: users["Bradner Road Greenhouses"]!.id, rating: 5, body: "Consistent quality and on-time Tuesday deliveries for months. Highly recommend." } });
  await db.review.create({ data: { authorId: buyer.id, subjectId: grower.id, rating: 5, body: "Beautiful fruit and great communication during the 2026 season." } });
  await db.review.create({ data: { authorId: users["Valley Pack Processors"]!.id, subjectId: grower.id, rating: 4, body: "Reliable tote volumes, brix always on spec." } });

  /* ---------------- Demand board ---------------- */
  const demand = [
    { b: "Coast Fresh Grocers", title: "Weekly greenhouse peppers for 14 stores", produce: "Bell Peppers", category: "vegetable", quantity: 1500, unit: "kg", frequency: "weekly", neededBy: 14, targetPrice: 4.4, details: "Mixed colours, retail-spec 5 kg cases, delivered to Vancouver DC Mondays." },
    { b: "Valley Pack Processors", title: "IQF-grade blueberries — 2027 contract", produce: "Blueberries", category: "berries", quantity: 200, unit: "tonne", frequency: "seasonal", neededBy: 240, details: "Seeking multiple growers for 2027 processing contracts. Tote delivery to Abbotsford plant." },
    { b: "Harbour Table Restaurant Group", title: "Organic microgreens & edible flowers", produce: "Microgreens", category: "herbs", quantity: 20, unit: "kg", frequency: "weekly", neededBy: 7, details: "Restaurant-grade, delivered Vancouver + Victoria." },
    { b: "Pacific Gateway Exports", title: "Export-grade cherries for Asia (2027)", produce: "Cherries", category: "fruit", quantity: 80, unit: "tonne", frequency: "seasonal", neededBy: 250, targetPrice: 11, details: "9.5-row and up, CFIA export certification required. EDC credit insurance in place." },
    { b: "Okanagan Market Co-op", title: "Local eggs for co-op shelves", produce: "Eggs", category: "poultry_eggs", quantity: 120, unit: "dozen", frequency: "weekly", neededBy: 10, details: "Free-range preferred." },
  ];
  for (const x of demand) {
    const reg = regions[users[x.b]!.regionSlug]!;
    await db.demandPost.create({ data: { buyerId: users[x.b]!.id, title: x.title, produce: x.produce, category: x.category as Prisma.DemandPostCreateInput["category"], quantity: x.quantity, unit: x.unit, frequency: x.frequency, neededBy: d(x.neededBy), targetPrice: x.targetPrice, regionId: reg.id, details: x.details, approval: "approved", createdAt: d(-x.neededBy / 10 - 2) } });
  }

  /* ---------------- Resources (partner programs) ---------------- */
  const res = [
    { o: "Farm Credit Canada", type: "financing", title: "Young Farmer Loan", summary: "Financing for producers under 40 to purchase or improve farmland and buildings.", eligibility: "Producers under 40. See FCC for current terms.", url: "https://www.fcc-fac.ca", featured: true, tags: ["young farmers", "land"] },
    { o: "Export Development Canada", type: "export", title: "Export Guarantee Program", summary: "EDC can guarantee a portion of a working-capital loan from your bank so you can fulfil export contracts.", eligibility: "Canadian exporters with export contracts. Confirm details with EDC.", url: "https://www.edc.ca", featured: true, tags: ["export", "working capital"] },
    { o: "Export Development Canada", type: "export", title: "Credit Insurance for Agri-food Exporters", summary: "Protect export receivables against buyer non-payment when selling to new markets.", url: "https://www.edc.ca", tags: ["export", "insurance"] },
    { o: "BC Ministry of Agriculture and Food", type: "grant", title: "Buy BC Partnership Program", summary: "Cost-shared funding for BC producers and processors to market BC-grown products with the Buy BC logo.", eligibility: "BC agriculture, food and beverage businesses. Check intake dates on the BC Government site.", url: "https://www2.gov.bc.ca/gov/content/industry/agriculture-seafood/programs", featured: true, tags: ["buy bc", "marketing"] },
    { o: "BC Ministry of Agriculture and Food", type: "program", title: "Farm Business Advisory Services", summary: "Access to professional business consultants for farm business planning.", url: "https://www2.gov.bc.ca/gov/content/industry/agriculture-seafood/programs", tags: ["business planning"] },
    { o: "AAFC — Agassiz Research and Development Centre", type: "research", title: "Sustainable Canadian Agricultural Partnership (federal programs)", summary: "Federal-provincial-territorial programs (2023–2028) supporting competitiveness, innovation and resiliency.", url: "https://agriculture.canada.ca", tags: ["federal", "innovation"] },
    { o: "UBC Faculty of Land and Food Systems", type: "research", title: "Applied research & student placements", summary: "Partner with faculty and students on on-farm trials, food-security research and co-op placements.", url: "https://landfood.ubc.ca", tags: ["research", "students"] },
    { o: "Kwantlen Polytechnic University — Sustainable Agriculture", type: "course", title: "Sustainable agriculture short courses", summary: "Practical training in small-scale and sustainable farm production and business.", url: "https://www.kpu.ca", tags: ["training"] },
    { o: "Fraser Valley Agri Consulting", type: "service", title: "CanadaGAP audit readiness package", summary: "Gap assessment, record templates and a mock audit so you pass your first CanadaGAP audit.", amount: "From $1,800", tags: ["food safety", "canadagap"], interest: true },
    { o: "GreenGrow AgTech Solutions", type: "product", title: "Free 60-day sensor trial for berry growers", summary: "Six soil-moisture probes plus a canopy climate sensor with irrigation alerts — installed free for 60 days.", eligibility: "Fraser Valley berry and greenhouse growers.", amount: "Free trial", tags: ["sensors", "irrigation"], featured: true, interest: true },
    { o: "Valley Equipment Leasing", type: "financing", title: "Harvest-season lease payments", summary: "Lease-to-own harvesters and greenhouse systems with payments scheduled after harvest.", amount: "Up to 7-year terms", tags: ["equipment", "leasing"] },
  ];
  for (const r of res) {
    const row = await db.resource.create({ data: { profileId: users[r.o]!.profileId, type: r.type as Prisma.ResourceCreateInput["type"], title: r.title, summary: r.summary, eligibility: r.eligibility, amount: r.amount, externalUrl: r.url, tags: r.tags, isFeatured: r.featured ?? false, approval: "approved" } });
    if (r.interest) await db.resourceInterest.create({ data: { resourceId: row.id, userId: grower.id, message: "Interested — can we book a call next week?" } });
  }

  /* ---------------- Events (incl. real GRIS programmes) ---------------- */
  const ev = [
    { title: "Agri Innovation Challenge — National Finale", type: "trade_show", start: new Date("2027-04-14T15:00:00Z"), location: "University of Guelph, Ontario", desc: "GRIS Canada's Agri Innovation Challenge national finale. Two tracks: Early-Stage ($0–$500K revenue) and Growth-Stage ($500K+).", host: null },
    { title: "AgriFest Canada 2027", type: "trade_show", start: new Date("2027-07-15T17:00:00Z"), location: "Dates & location TBA", desc: "GRIS Canada's summer festival of agri-food innovation — dates and location to be announced.", host: null },
    { title: "Winter Webinar: Selling to BC Grocery Buyers", type: "webinar", start: d(12), online: true, desc: "What retail buyers look for: pack specs, Buy BC, food-safety paperwork and pricing.", host: "Harvest Story Marketing" },
    { title: "CanadaGAP Prep Workshop (Abbotsford)", type: "workshop", start: d(21), location: "Abbotsford, BC", desc: "Half-day hands-on workshop to get your records audit-ready.", host: "Fraser Valley Agri Consulting", capacity: 30 },
    { title: "Greenhouse Tech Farm Tour", type: "farm_tour", start: d(35), location: "Bradner Road, Abbotsford", desc: "See LED inter-lighting and closed-loop irrigation in action.", host: "GreenGrow AgTech Solutions", capacity: 25 },
  ];
  for (const e of ev) {
    const row = await db.event.create({ data: { title: e.title, type: e.type as Prisma.EventCreateInput["type"], startsAt: e.start, endsAt: new Date(e.start.getTime() + 2 * 3600000), location: e.location, onlineUrl: e.online ? "https://griscanada.org" : null, description: e.desc, capacity: e.capacity, hostProfileId: e.host ? users[e.host]!.profileId : null, approval: "approved", coverUrl: `/seed/cover-${(e.title.length % 4) + 1}.svg` } });
    await db.eventRsvp.create({ data: { eventId: row.id, userId: grower.id } });
  }

  /* ---------------- Community spaces & posts ---------------- */
  const spaces = [
    { slug: "announcements", name: "Announcements", icon: "Megaphone", description: "News from GRIS Canada and the AGRI HUB team.", isLocked: true },
    { slug: "berries", name: "Berries & Small Fruit", icon: "Cherry", description: "Blueberries, raspberries, strawberries — growing, pricing, processing." },
    { slug: "greenhouse", name: "Greenhouse & CEA", icon: "Warehouse", description: "Controlled-environment agriculture, lighting, energy, labour." },
    { slug: "export", name: "Export & Market Access", icon: "Globe", description: "Export readiness, EDC, CFIA certification, new markets." },
    { slug: "funding", name: "Funding & Financing", icon: "Landmark", description: "Grants, loans, leasing — share what's open and what worked." },
    { slug: "agtech", name: "Ag-Tech & Innovation", icon: "Cpu", description: "Sensors, robotics, data and on-farm trials." },
    { slug: "new-farmers", name: "New & Young Farmers", icon: "Sprout", description: "Questions welcome — mentors from across BC." },
  ];
  const spaceIds: Record<string, string> = {};
  for (const [i, s] of spaces.entries()) spaceIds[s.slug] = (await db.space.create({ data: { ...s, sortOrder: i } })).id;
  const posts = [
    { s: "announcements", a: admin.id, title: "Welcome to AGRI HUB 🌱", body: "AGRI HUB is GRIS Canada's connection platform for BC's fresh-produce ecosystem. Create your profile, list what you grow or need, and connect directly with growers, buyers and partners. BC imports 77.1% of its fresh vegetables — together we're working to move that toward 55–60%.", pinned: true },
    { s: "berries", a: grower.id, title: "2027 blueberry pre-booking — what are processors offering?", body: "Starting to plan 2027 allocation. Anyone seeing early processor contract prices yet? Last season felt soft on IQF." },
    { s: "greenhouse", a: users["Bradner Road Greenhouses"]!.id, title: "LED inter-lighting payback — our numbers", body: "We moved 4 acres to LED inter-lighting last winter. Energy down ~18%, winter yield up. Happy to share details on the farm tour." },
    { s: "export", a: users["Pacific Gateway Exports"]!.id, title: "Looking for cherry growers for 2027 Asia program", body: "We're consolidating export-grade cherries near YVR. Posted details on the demand board — happy to talk CFIA paperwork." },
    { s: "funding", a: users["Fraser Valley Agri Consulting"]!.id, title: "Buy BC Partnership Program tips", body: "Three things that strengthen an application: a clear marketing plan, quotes for every cost, and photos of how you'll use the logo." },
    { s: "agtech", a: users["GreenGrow AgTech Solutions"]!.id, title: "Free sensor trials — 10 spots left", body: "Our 60-day trial is open to Fraser Valley berry & greenhouse growers. Express interest in the Resource Hub." },
    { s: "new-farmers", a: users["Cowichan Market Garden"]!.id, title: "First year selling to restaurants — advice?", body: "How do you price for chefs vs farmers markets? Any templates for standing orders?" },
  ];
  for (const [i, p] of posts.entries()) {
    const post = await db.post.create({ data: { spaceId: spaceIds[p.s]!, authorId: p.a, title: p.title, body: p.body, isPinned: p.pinned ?? false, createdAt: d(-14 + i) } });
    await db.reaction.createMany({ data: [buyer.id, grower.id, users["Matsqui Valley Blueberries"]!.id].filter((u) => u !== p.a).map((userId) => ({ postId: post.id, userId })) });
    if (i === 1) await db.comment.create({ data: { postId: post.id, authorId: users["Valley Pack Processors"]!.id, body: "We'll publish our 2027 contract terms in January — watch the demand board." } });
    if (i === 6) await db.comment.create({ data: { postId: post.id, authorId: users["Harbour Table Restaurant Group"]!.id, body: "Chefs value consistency over price — a weekly availability list helps a lot." } });
  }

  /* ---------------- Activity (demand-signal charts) ---------------- */
  const events: Prisma.ActivityEventCreateManyInput[] = [];
  const growerIds = Object.values(users).filter((u) => u.role === "grower");
  for (let w = 0; w < 12; w++) {
    for (const g of growerIds) {
      const views = Math.round(3 + w * 0.9 + ((g.org.length + w) % 5));
      for (let i = 0; i < views; i++) events.push({ type: "listing_view", ownerId: g.id, createdAt: d(-84 + w * 7 + (i % 7)) });
      const inq = Math.round((w / 4 + (g.org.length % 3)) / 2);
      for (let i = 0; i < inq; i++) events.push({ type: "inquiry", ownerId: g.id, createdAt: d(-84 + w * 7 + (i % 7)) });
    }
    for (let i = 0; i < 2 + (w % 3); i++) events.push({ type: "signup", createdAt: d(-84 + w * 7 + i) });
  }
  await db.activityEvent.createMany({ data: events });

  /* ---------------- Notifications, report, KPI targets, settings ---------------- */
  await db.notification.createMany({
    data: [
      { userId: grower.id, type: "rfq", title: "New RFQ from Coast Fresh Grocers", body: "12,000 kg Highbush Blueberries", link: `/messages/${t1}`, createdAt: d(-6) },
      { userId: grower.id, type: "review", title: "Valley Pack Processors left you a 4★ review", link: `/directory/sumas-prairie-berry-co`, createdAt: d(-2) },
      { userId: buyer.id, type: "quote", title: "Sumas Prairie Berry Co. sent a quote: $4.05/kg", link: `/messages/${t1}`, createdAt: d(-5) },
    ],
  });
  await db.report.create({ data: { reporterId: buyer.id, targetType: "listing", targetId: listingIds["Hot Peppers Mix"]!, reason: "Misleading listing", details: "Photos look like a different product." } });

  const kpis = [
    { key: "growers_served", label: "Growers served", group: "five_year", metric: "growers", targetValue: 500, targetLabel: "300–500", unit: "growers", sortOrder: 1 },
    { key: "incubator_grads", label: "Incubator / accelerator graduates", group: "five_year", metric: null, targetValue: 150, targetLabel: "150+", currentValue: 0, unit: "graduates", sortOrder: 2 },
    { key: "export_buyers", label: "Export buyer relationships", group: "five_year", metric: "export_buyers", targetValue: 10, targetLabel: "10+", unit: "buyers", sortOrder: 3 },
    { key: "import_dependence", label: "BC vegetable import dependence", group: "five_year", metric: null, targetValue: 57.5, targetLabel: "77.1% → 55–60%", baseline: 77.1, currentValue: 77.1, unit: "%", sortOrder: 4 },
    { key: "jobs", label: "Jobs created (direct + indirect)", group: "five_year", metric: null, targetValue: 1000, targetLabel: "500–1,000", currentValue: 0, unit: "jobs", sortOrder: 5 },
    { key: "t90_growers", label: "Registered growers", group: "traction_90", metric: "growers", targetValue: 60, targetLabel: "40–60", sortOrder: 1 },
    { key: "t90_buyers", label: "Registered buyers", group: "traction_90", metric: "buyers", targetValue: 25, targetLabel: "15–25", sortOrder: 2 },
    { key: "t90_partners", label: "Partner org profiles", group: "traction_90", metric: "partners", targetValue: 15, targetLabel: "10–15", sortOrder: 3 },
    { key: "t90_listings", label: "Active listings", group: "traction_90", metric: "activeListings", targetValue: 80, targetLabel: "80+", sortOrder: 4 },
    { key: "t90_inquiries", label: "Inquiries / connections", group: "traction_90", metric: "inquiries", targetValue: 50, targetLabel: "50+", sortOrder: 5 },
    { key: "t90_transactions", label: "Completed transactions", group: "traction_90", metric: "transactions", targetValue: 10, targetLabel: "5–10", sortOrder: 6 },
    { key: "t180_growers", label: "Registered growers", group: "traction_180", metric: "growers", targetValue: 150, targetLabel: "150+", sortOrder: 1 },
    { key: "t180_buyers", label: "Registered buyers", group: "traction_180", metric: "buyers", targetValue: 50, targetLabel: "50+", sortOrder: 2 },
    { key: "t180_partners", label: "Partner org profiles", group: "traction_180", metric: "partners", targetValue: 30, targetLabel: "30+", sortOrder: 3 },
    { key: "t180_listings", label: "Active listings", group: "traction_180", metric: "activeListings", targetValue: 300, targetLabel: "300+", sortOrder: 4 },
    { key: "t180_inquiries", label: "Inquiries / connections", group: "traction_180", metric: "inquiries", targetValue: 250, targetLabel: "250+", sortOrder: 5 },
    { key: "t180_transactions", label: "Completed transactions", group: "traction_180", metric: "transactions", targetValue: 40, targetLabel: "40+", sortOrder: 6 },
  ];
  await db.kpiTarget.createMany({ data: kpis });
  await db.siteSetting.createMany({ data: [{ key: "moderation", value: "post" }, { key: "announcement", value: "Pilot launch: Abbotsford grower cohort now onboarding — list your 2027 harvest today." }] });

  const counts = await Promise.all([db.user.count(), db.listing.count(), db.resource.count(), db.event.count(), db.post.count()]);
  console.log(`Seeded: ${counts[0]} users, ${counts[1]} listings, ${counts[2]} resources, ${counts[3]} events, ${counts[4]} posts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
