import { z } from "zod";
import { handler, body, zDate, zOptText, zReqText } from "@/server/api";
import { CATEGORIES, FREQUENCIES, UNITS } from "@/lib/constants";

export const demandSchema = z.object({
  title: zReqText(120, 3),
  produce: zReqText(60, 2),
  category: z.enum(CATEGORIES.map((c) => c.key) as [string, ...string[]]),
  quantity: z.coerce.number().positive("Enter a quantity").max(1e9),
  unit: z.enum(UNITS as [string, ...string[]]),
  frequency: z.enum(FREQUENCIES.map((f) => f.key) as [string, ...string[]]),
  neededBy: zDate,
  targetPrice: z.coerce.number().min(0).max(1e6).optional().nullable(),
  regionId: zOptText(40),
  details: zOptText(3000),
});
