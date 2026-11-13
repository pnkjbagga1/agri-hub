import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, fail, zDate, zOptText } from "@/server/api";
import { assertCanAct } from "@/server/rules";
import { findOrCreateThread, postMessage, track } from "@/server/threads";
import { formatMoney, formatNumber } from "@/lib/utils";
import { UNITS } from "@/lib/constants";

const schema = z.object({
  listingId: z.string().max(40),
  quantity: z.coerce.number().positive("Enter a quantity").max(1e9),
  unit: z.enum(UNITS as [string, ...string[]]),
  deliveryDate: zDate,
  targetPrice: z.coerce.number().min(0).max(1e6).optional().nullable(),
  notes: zOptText(2000),
});

/** Buyer sends a structured Request for Quote on a listing. */
export const POST = handler({ auth: true, rateLimit: [20, 3600], name: "rfq" }, async ({ req, user }) => {
  await assertCanAct(user, { messaging: true });
  const data = await body(req, schema);
  const listing = await db.listing.findUnique({ where: { id: data.listingId } });
  if (!listing || listing.status !== "active") fail(404, "This listing isn't accepting quotes right now.");
  if (listing!.growerId === user.id) fail(422, "You can't request a quote on your own listing.");
  // dates are entered as calendar days: anything before today (Pacific time) is in the past
  const todayPT = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/Vancouver" }));
  if (data.deliveryDate && data.deliveryDate < todayPT) fail(422, "Delivery date must be today or later.", { deliveryDate: "Must be today or later" });
  const t = await findOrCreateThread(user.id, listing!.growerId, listing!.id, listing!.title);
  // check-and-create under a per-buyer/listing lock so parallel submits can't open duplicate RFQs
  const rfq = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"rfq:" + user.id + ":" + listing!.id}))`;
    const open = await tx.rfq.count({ where: { buyerId: user.id, listingId: listing!.id, status: { in: ["open", "quoted"] } } });
    if (open) fail(409, "You already have an open RFQ on this listing — reply in the conversation.");
    return tx.rfq.create({ data: { buyerId: user.id, growerId: listing!.growerId, listingId: listing!.id, threadId: t.id, quantity: data.quantity, unit: data.unit, deliveryDate: data.deliveryDate, targetPrice: data.targetPrice ?? null, notes: data.notes } });
  });
  const summary = `RFQ: ${formatNumber(data.quantity)} ${data.unit}${data.targetPrice != null ? ` @ target ${formatMoney(data.targetPrice)}/${listing!.priceUnit ?? data.unit}` : ""}${data.deliveryDate ? `, delivery ${data.deliveryDate.toISOString().slice(0, 10)}` : ""}${data.notes ? ` — ${data.notes}` : ""}`;
  await postMessage(t.id, user.id, summary, "rfq", { rfqId: rfq.id });
  await track("rfq", { userId: user.id, listingId: listing!.id, ownerId: listing!.growerId });
  if (t.created) await track("inquiry", { userId: user.id, listingId: listing!.id, ownerId: listing!.growerId });
  return { ok: true, rfqId: rfq.id, threadId: t.id };
});
