import { z } from "zod";
import { handler, body, fail, zDate, zOptText, zReqText, zUrl } from "@/server/api";
import { PARTNER_ROLES, RESOURCE_TYPES } from "@/lib/constants";

export const resourceSchema = z.object({
  type: z.enum(RESOURCE_TYPES.map((r) => r.key) as [string, ...string[]]),
  title: zReqText(140, 3),
  summary: zReqText(400, 10),
  body: zOptText(6000),
  eligibility: zOptText(1000),
  amount: zOptText(80),
  deadline: zDate,
  externalUrl: zUrl,
  tags: z.array(z.string().trim().toLowerCase().max(30)).max(10).default([]),
});
