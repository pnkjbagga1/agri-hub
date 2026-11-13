import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, fail, zOptText } from "@/server/api";
import { postMessage, track } from "@/server/threads";
import { formatMoney } from "@/lib/utils";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("quote"), price: z.coerce.number().min(0).max(1e6), notes: zOptText(2000) }),
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("decline"), notes: zOptText(500) }),
  z.object({ action: z.literal("withdraw") }),
]);

/** RFQ workflow: grower quotes or declines; buyer accepts or withdraws. Every step is posted to the thread. */
export const POST = handler<{ id: string }>({ auth: true, rateLimit: [60, 3600], name: "rfq-act" }, async ({ req, params, user }) => {
  const rfq = await db.rfq.findUnique({ where: { id: params.id } });
  if (!rfq || (rfq.buyerId !== user.id && rfq.growerId !== user.id)) fail(404, "RFQ not found.");
  const r = rfq!;
  const data = await body(req, schema);
  const isGrower = r.growerId === user.id;
  switch (data.action) {
    case "quote": {
      if (!isGrower) fail(403, "Only the grower can send a quote.");
      const u = await db.rfq.updateMany({ where: { id: r.id, status: { in: ["open", "quoted"] } }, data: { status: "quoted", quotePrice: data.price, quoteNotes: data.notes, respondedAt: new Date() } });
      if (!u.count) fail(409, "This RFQ is closed.");
      await postMessage(r.threadId, user.id, `Quote: ${formatMoney(data.price)} per ${r.unit}${data.notes ? ` — ${data.notes}` : ""}`, "quote", { rfqId: r.id, price: data.price });
      return { ok: true, status: "quoted" };
    }
    case "accept": {
      if (isGrower) fail(403, "Only the buyer can accept a quote.");
      const u = await db.rfq.updateMany({ where: { id: r.id, status: "quoted" }, data: { status: "accepted", closedAt: new Date() } });
      if (!u.count) fail(409, "There's no open quote to accept.");
      await postMessage(r.threadId, user.id, `Quote accepted at ${formatMoney(r.quotePrice)} per ${r.unit}. Please confirm delivery details here.`, "system", { rfqId: r.id });
      await track("transaction", { userId: user.id, listingId: r.listingId ?? undefined, ownerId: r.growerId, meta: { value: (r.quotePrice ?? 0) * r.quantity } });
      return { ok: true, status: "accepted" };
    }
    case "decline": {
      if (!isGrower) fail(403, "Only the grower can decline.");
      const u = await db.rfq.updateMany({ where: { id: r.id, status: { in: ["open", "quoted"] } }, data: { status: "declined", closedAt: new Date(), quoteNotes: data.notes } });
      if (!u.count) fail(409, "This RFQ is closed.");
      await postMessage(r.threadId, user.id, `RFQ declined${data.notes ? ` — ${data.notes}` : ""}.`, "system", { rfqId: r.id });
      return { ok: true, status: "declined" };
    }
    case "withdraw": {
      if (isGrower) fail(403, "Only the buyer can withdraw.");
      const u = await db.rfq.updateMany({ where: { id: r.id, status: { in: ["open", "quoted"] } }, data: { status: "withdrawn", closedAt: new Date() } });
      if (!u.count) fail(409, "This RFQ is closed.");
      await postMessage(r.threadId, user.id, "RFQ withdrawn by the buyer.", "system", { rfqId: r.id });
      return { ok: true, status: "withdrawn" };
    }
  }
});
