import { z } from "zod";
import { zDate, zMedia, zOptText, zReqText } from "@/server/api";
import { CATEGORIES, DELIVERY_OPTIONS, PRICING_METHODS, UNITS } from "@/lib/constants";

export const listingSchema = z
  .object({
    title: zReqText(120, 3),
    produce: zReqText(60, 2),
    variety: zOptText(60),
    category: z.enum(CATEGORIES.map((c) => c.key) as [string, ...string[]]),
    description: zOptText(4000),
    volume: z.coerce.number().positive("Enter the available volume").max(1e9),
    unit: z.enum(UNITS as [string, ...string[]]),
    minOrder: z.coerce.number().positive().max(1e9).optional().nullable(),
    price: z.coerce.number().min(0).max(1e6).optional().nullable(),
    priceUnit: zOptText(20),
    pricingMethod: z.enum(PRICING_METHODS.map((p) => p.key) as [string, ...string[]]).default("fixed"),
    harvestStart: zDate,
    harvestEnd: zDate,
    deliveryOptions: z.array(z.enum(DELIVERY_OPTIONS.map((d) => d.key) as [string, ...string[]])).max(3).default([]),
    deliveryArea: zOptText(160),
    pickupLocation: zOptText(160),
    regionId: zOptText(40),
    photos: z.array(zMedia).max(10).default([]),
    status: z.enum(["draft", "active", "paused", "sold_out", "archived"]).default("active"),
    growerId: z.string().max(40).optional(), // admin "assisted listing" on behalf of a grower
  })
  .refine((d) => !(d.harvestStart && d.harvestEnd) || d.harvestEnd >= d.harvestStart, { message: "Harvest end must be after the start", path: ["harvestEnd"] })
  .refine((d) => d.status !== "active" || d.photos.length >= 1, { message: "Add at least one photo to publish", path: ["photos"] })
  .refine((d) => d.pricingMethod === "rfq" || d.pricingMethod === "market" || d.price != null, { message: "Enter a price or choose 'Request a quote'", path: ["price"] });
