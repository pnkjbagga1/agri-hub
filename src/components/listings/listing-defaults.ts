// Shared (server + client) listing form defaults. Kept out of the "use client" module so
// server components receive real values, not client references.

export type ListingValues = {
  id?: string;
  title: string;
  produce: string;
  variety: string | null;
  category: string;
  description: string | null;
  volume: number | null;
  unit: string;
  minOrder: number | null;
  price: number | null;
  priceUnit: string | null;
  pricingMethod: string;
  harvestStart: string | null;
  harvestEnd: string | null;
  deliveryOptions: string[];
  deliveryArea: string | null;
  pickupLocation: string | null;
  regionId: string | null;
  photos: string[];
  status: string;
};

export const EMPTY_LISTING: ListingValues = { title: "", produce: "", variety: null, category: "berries", description: null, volume: null, unit: "kg", minOrder: null, price: null, priceUnit: "kg", pricingMethod: "fixed", harvestStart: null, harvestEnd: null, deliveryOptions: ["pickup"], deliveryArea: null, pickupLocation: null, regionId: null, photos: [], status: "active" };
