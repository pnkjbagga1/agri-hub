// Shared, client-safe constants. No server imports in this file.

export const APP_NAME = "AGRI HUB";
export const ORG_NAME = "GRIS Canada";
export const ORG_FULL = "GRIS Canada — Green Revolution Innovation Society";
export const TAGLINE = "Ecosystem • Marketplace • Grow • Connect • Global";

export type RoleKey =
  | "grower"
  | "buyer"
  | "university"
  | "consultant"
  | "edc"
  | "fcc"
  | "financing"
  | "bc_gov"
  | "fed_gov"
  | "agtech"
  | "sales_marketing"
  | "supplier"
  | "dealer"
  | "admin";

/** The 8 role cards shown at sign-up. Each maps to one or more DB enum values. */
export const ROLE_CARDS: {
  key: string;
  label: string;
  short: string;
  roles: RoleKey[];
  icon: string;
  blurb: string;
  portal: "member" | "partner";
}[] = [
  { key: "grower", label: "Farmer / Grower", short: "Grower", roles: ["grower"], icon: "Sprout", blurb: "List produce with photos, set volume, price and harvest window, answer inquiries.", portal: "member" },
  { key: "buyer", label: "Buyer (Retail / Food Service / Processor)", short: "Buyer", roles: ["buyer"], icon: "ShoppingBasket", blurb: "Search local supply, send RFQs, post what you need, message growers.", portal: "member" },
  { key: "university", label: "University / Researcher", short: "University", roles: ["university"], icon: "GraduationCap", blurb: "Share research, courses and webinars; recruit applied-research partners.", portal: "partner" },
  { key: "consultant", label: "Consultant / Subject Matter Expert", short: "Consultant", roles: ["consultant"], icon: "BriefcaseBusiness", blurb: "List services and specialties; take consultation requests.", portal: "partner" },
  { key: "finance", label: "EDC / FCC / Financing Institution", short: "Financing", roles: ["edc", "fcc", "financing"], icon: "Landmark", blurb: "Post export-financing, loan and lease programs; receive referrals.", portal: "partner" },
  { key: "government", label: "BC / Federal Government Program", short: "Government", roles: ["bc_gov", "fed_gov"], icon: "Building2", blurb: "Post grants, Buy BC links, AAFC / PacifiCan programs and funding calls.", portal: "partner" },
  { key: "agtech", label: "Ag-Tech / New Technology Company", short: "Ag-Tech", roles: ["agtech"], icon: "Cpu", blurb: "Showcase products, offer demos and on-farm trials.", portal: "partner" },
  { key: "sales_marketing", label: "Sales & Marketing Partner", short: "Sales & Marketing", roles: ["sales_marketing"], icon: "Megaphone", blurb: "Offer branding, packaging and go-to-market services to growers.", portal: "partner" },
  { key: "supplier", label: "Supplier / Equipment Dealer", short: "Supplier / Dealer", roles: ["supplier", "dealer"], icon: "Tractor", blurb: "Seed, inputs, packaging, machinery sales, leasing and service for farms.", portal: "partner" },
];

export const ROLE_LABELS: Record<RoleKey, string> = {
  grower: "Grower",
  buyer: "Buyer",
  university: "University",
  consultant: "Consultant",
  edc: "EDC",
  fcc: "FCC",
  financing: "Financing",
  bc_gov: "BC Government",
  fed_gov: "Federal Government",
  agtech: "Ag-Tech",
  sales_marketing: "Sales & Marketing",
  supplier: "Supplier",
  dealer: "Equipment Dealer",
  admin: "Admin",
};

/** Pill colours per role (Tailwind classes). */
export const ROLE_TONE: Record<RoleKey, string> = {
  grower: "bg-[#e3f0e1] text-[#0B5A14] ring-[#0B5A14]/20",
  buyer: "bg-[#fbf1dc] text-[#7a5a12] ring-[#C99A2E]/30",
  university: "bg-[#e4eef6] text-[#24557a] ring-[#24557a]/20",
  consultant: "bg-[#f8e5e3] text-[#9b2c22] ring-[#9b2c22]/20",
  edc: "bg-[#e1efe9] text-[#2f6b55] ring-[#2f6b55]/20",
  fcc: "bg-[#ece6f6] text-[#5b3f93] ring-[#5b3f93]/20",
  financing: "bg-[#f3e7dc] text-[#8a4f22] ring-[#8a4f22]/20",
  bc_gov: "bg-[#e3e8ef] text-[#1f3a5c] ring-[#1f3a5c]/20",
  fed_gov: "bg-[#f4ecd9] text-[#7b5d1d] ring-[#7b5d1d]/20",
  agtech: "bg-[#ddf1ec] text-[#13695a] ring-[#13695a]/20",
  sales_marketing: "bg-[#e3e6f7] text-[#33449a] ring-[#33449a]/20",
  supplier: "bg-[#eef0dc] text-[#5c6b28] ring-[#5c6b28]/25",
  dealer: "bg-[#f1e6d6] text-[#7a4a1c] ring-[#7a4a1c]/20",
  admin: "bg-[#1A2B1A] text-white ring-black/10",
};

export const MEMBER_ROLES: RoleKey[] = ["grower", "buyer"];
export const PARTNER_ROLES: RoleKey[] = ["university", "consultant", "edc", "fcc", "financing", "bc_gov", "fed_gov", "agtech", "sales_marketing", "supplier", "dealer"];

/** Directory filter tabs (spec screen 6). */
export const DIRECTORY_TABS: { key: string; label: string; roles: RoleKey[]; buyerType?: string; notBuyerType?: string; cert?: string }[] = [
  { key: "all", label: "All", roles: [] },
  { key: "farmers", label: "Farmers", roles: ["grower"] },
  { key: "buyers", label: "Buyers", roles: ["buyer"], notBuyerType: "processor" },
  { key: "processors", label: "Processors", roles: ["buyer"], buyerType: "processor" },
  { key: "buy-bc", label: "Buy BC licensees", roles: [], cert: "buy_bc" },
  { key: "universities", label: "Universities", roles: ["university"] },
  { key: "consultants", label: "Consultants", roles: ["consultant"] },
  { key: "edc-fcc", label: "EDC / FCC", roles: ["edc", "fcc"] },
  { key: "government", label: "Government", roles: ["bc_gov", "fed_gov"] },
  { key: "agtech", label: "Ag-Tech", roles: ["agtech"] },
  { key: "financing", label: "Financing", roles: ["financing"] },
  { key: "marketing", label: "Sales & Marketing", roles: ["sales_marketing"] },
  { key: "suppliers", label: "Suppliers", roles: ["supplier"] },
  { key: "dealers", label: "Dealers & Equipment", roles: ["dealer"] },
];

/** The live griscanada.org/hub "Eight doors, one hallway" — each door opens a filtered view of AGRI HUB. */
export const EIGHT_DOORS: { n: string; title: string; body: string; href: string }[] = [
  { n: "01", title: "Funding and Grants", body: "Current funding programs, grant deadlines and investors who back agriculture, explained in plain language.", href: "/resources?type=grant&type=financing&type=export" },
  { n: "02", title: "Subject Matter Experts", body: "Agronomy, soil health, crop science, food safety and farm business expertise, bookable through the network.", href: "/directory?tab=consultants" },
  { n: "03", title: "Suppliers", body: "Seed, inputs, packaging and technology suppliers who work with Canadian farms of every size.", href: "/directory?tab=suppliers" },
  { n: "04", title: "Dealers and Equipment", body: "Machinery and equipment dealers for purchase, lease and service, matched to your region and operation.", href: "/directory?tab=dealers" },
  { n: "05", title: "Growers Network", body: "Peer growers across Canada and partner growers abroad, organized by crop, region and shared challenges.", href: "/directory?tab=farmers" },
  { n: "06", title: "Processors", body: "Processing capacity and partners who turn raw harvests into finished, shelf ready Canadian products.", href: "/directory?tab=processors" },
  { n: "07", title: "Research and Pilots", body: "Live pilot opportunities, trial results and research partners looking for farms to work with.", href: "/resources?type=research&type=product" },
  { n: "08", title: "Markets and Buyers", body: "Retail, wholesale, export and institutional buyers, plus guidance on what each market expects.", href: "/demand" },
];

export const CATEGORIES: { key: string; label: string }[] = [
  { key: "berries", label: "Berries" },
  { key: "vegetable", label: "Vegetables" },
  { key: "fruit", label: "Fruit" },
  { key: "herbs", label: "Herbs" },
  { key: "dairy", label: "Dairy" },
  { key: "nursery", label: "Nursery" },
  { key: "poultry_eggs", label: "Poultry & Eggs" },
  { key: "grains", label: "Grains" },
  { key: "value_added", label: "Value-Added" },
];
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

export const CERTIFICATIONS: { key: string; label: string; tone: string }[] = [
  { key: "organic", label: "Organic", tone: "bg-[#e7f3df] text-[#2c6b12] ring-[#2c6b12]/25" },
  { key: "buy_bc", label: "Buy BC", tone: "bg-[#e3ecf7] text-[#1d4f91] ring-[#1d4f91]/25" },
  { key: "canadagap", label: "GAP Food Safety", tone: "bg-[#fbefd6] text-[#8a5a00] ring-[#C99A2E]/40" },
  { key: "haccp", label: "HACCP", tone: "bg-[#f2e4f1] text-[#7a2f74] ring-[#7a2f74]/25" },
  { key: "salmon_safe", label: "Salmon-Safe", tone: "bg-[#ddf0f2] text-[#12606b] ring-[#12606b]/25" },
];
export const CERT_LABEL: Record<string, string> = Object.fromEntries(CERTIFICATIONS.map((c) => [c.key, c.label]));

export const UNITS = ["kg", "lb", "tonne", "flat", "case", "dozen", "plant"];
export const PRICING_METHODS: { key: string; label: string }[] = [
  { key: "fixed", label: "Fixed price" },
  { key: "negotiable", label: "Negotiable" },
  { key: "market", label: "Market price" },
  { key: "rfq", label: "Request a quote" },
];
export const DELIVERY_OPTIONS: { key: string; label: string }[] = [
  { key: "pickup", label: "Farm pickup" },
  { key: "delivery", label: "Local delivery" },
  { key: "shipping", label: "Cold-chain shipping" },
];
export const BUYER_TYPES: { key: string; label: string }[] = [
  { key: "retail", label: "Retail / Grocery" },
  { key: "food_service", label: "Food Service / Restaurant" },
  { key: "processor", label: "Processor" },
  { key: "export", label: "Export / Distributor" },
];
export const RESOURCE_TYPES: { key: string; label: string }[] = [
  { key: "grant", label: "Grant" },
  { key: "financing", label: "Financing / Loan" },
  { key: "program", label: "Program" },
  { key: "export", label: "Export support" },
  { key: "course", label: "Course / Training" },
  { key: "research", label: "Research" },
  { key: "service", label: "Service" },
  { key: "product", label: "Product / Demo" },
];
export const RESOURCE_LABEL: Record<string, string> = Object.fromEntries(RESOURCE_TYPES.map((r) => [r.key, r.label]));
export const EVENT_TYPES: { key: string; label: string }[] = [
  { key: "webinar", label: "Webinar" },
  { key: "farm_tour", label: "Farm tour" },
  { key: "trade_show", label: "Trade show" },
  { key: "course", label: "Course" },
  { key: "workshop", label: "Workshop" },
  { key: "meetup", label: "Meetup" },
];
export const EVENT_LABEL: Record<string, string> = Object.fromEntries(EVENT_TYPES.map((r) => [r.key, r.label]));
export const FREQUENCIES: { key: string; label: string }[] = [
  { key: "one_time", label: "One-time" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "seasonal", label: "Seasonal contract" },
];
export const REPORT_REASONS = ["Spam or scam", "Misleading listing", "Food safety concern", "Inappropriate content", "Duplicate account", "Other"];
