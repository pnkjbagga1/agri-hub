import { z } from "zod";
import { body, handler } from "@/server/api";
import { answer, assistantEnabled } from "@/server/assistant";
import { track } from "@/server/notify";

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(16)
    .refine((m) => m.at(-1)?.role === "user", "The last message must be from the user."),
});

/** AGRI HUB Assistant. Public (visitors can ask too); rate limited per user/IP. */
export const POST = handler({ rateLimit: [20, 600], name: "assistant" }, async ({ req, user }) => {
  const { messages } = await body(req, schema);
  // keep the most recent context only; the first turn must be from the user
  const recent = messages.slice(-10);
  while (recent[0]?.role !== "user") recent.shift();
  const res = await answer(recent);
  await track("assistant_question", { userId: user?.id, meta: { mode: res.mode } });
  return res;
});

export const GET = handler({}, async () => ({ ai: assistantEnabled() }));
