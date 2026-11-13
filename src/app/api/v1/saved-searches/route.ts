import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, fail, zReqText } from "@/server/api";

const schema = z.object({
  name: zReqText(80),
  query: z.object({
    q: z.string().max(80).optional(),
    category: z.array(z.string().max(30)).max(10).optional(),
    region: z.array(z.string().max(40)).max(10).optional(),
    cert: z.array(z.string().max(30)).max(10).optional(),
  }),
  alert: z.boolean().default(true),
});

export const POST = handler({ auth: true, rateLimit: [30, 3600], name: "saved-search" }, async ({ req, user }) => {
  const data = await body(req, schema);
  if ((await db.savedSearch.count({ where: { userId: user.id } })) >= 25) fail(422, "You can keep up to 25 saved searches.");
  const s = await db.savedSearch.create({ data: { userId: user.id, name: data.name, query: data.query, alert: data.alert } });
  return { ok: true, id: s.id };
});
