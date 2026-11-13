import { z } from "zod";
import { handler, body, fail, zMedia, zOptText, zReqText, zUrl } from "@/server/api";
import { EVENT_TYPES, PARTNER_ROLES } from "@/lib/constants";

export const eventSchema = z
  .object({
    title: zReqText(140, 3),
    description: zReqText(5000, 10),
    type: z.enum(EVENT_TYPES.map((e) => e.key) as [string, ...string[]]),
    startsAt: z.string().min(1, "Required").transform((v) => new Date(v)),
    endsAt: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? new Date(v) : null)),
    location: zOptText(200),
    onlineUrl: zUrl,
    capacity: z.coerce.number().int().positive().max(100000).optional().nullable(),
    coverUrl: zMedia.optional().nullable(),
  })
  .refine((e) => !Number.isNaN(e.startsAt.getTime()), { message: "Invalid start", path: ["startsAt"] })
  .refine((e) => !e.endsAt || e.endsAt >= e.startsAt, { message: "End must be after start", path: ["endsAt"] })
  .refine((e) => e.location || e.onlineUrl, { message: "Add a location or an online link", path: ["location"] });
