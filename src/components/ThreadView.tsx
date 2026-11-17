"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, FileText, Send, BadgeDollarSign, Info, ShieldAlert, Lock } from "lucide-react";
import { api, ClientApiError } from "@/lib/client";
import { cn, formatDateTime } from "@/lib/utils";
import { messageRisks, type Risk } from "@/lib/safety";

type Msg = { id: string; body: string; kind: string; createdAt: string; senderId: string };

/** Live conversation: optimistic send + polling every 4s (swap for WebSockets/Pusher at scale). */
/** Warns the reader when a received message looks like a scam or asks for sensitive details. */
function ReaderWarning({ body }: { body: string }) {
  const r = messageRisks(body);
  if (!r.length) return null;
  return (
    <p className="mt-2 flex gap-1.5 rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
      <ShieldAlert className="mt-px size-3.5 shrink-0" />
      <span>
        Be careful: this message {r.map((x) => x.label).join(" and ")}. AGRI HUB never asks for payment or passwords in chat. If it seems wrong, don&apos;t reply and contact us.
      </span>
    </p>
  );
}

export function ThreadView({ threadId, me, initial, initialOtherRead, names }: { threadId: string; me: string; initial: Msg[]; initialOtherRead: string | null; names: Record<string, string> }) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [otherRead, setOtherRead] = useState<string | null>(initialOtherRead);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [risks, setRisks] = useState<Risk[] | null>(null); // a "before you send" check is open
  const end = useRef<HTMLDivElement>(null);
  const last = useRef(initial.at(-1)?.createdAt ?? null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await api<{ messages: Msg[]; otherLastReadAt: string | null }>(`/threads/${threadId}/messages${last.current ? `?after=${encodeURIComponent(last.current)}` : ""}`);
        if (stop) return;
        if (r.messages.length) {
          setMessages((m) => {
            const ids = new Set(m.map((x) => x.id));
            return [...m, ...r.messages.filter((x) => !ids.has(x.id))];
          });
          last.current = r.messages.at(-1)!.createdAt;
        }
        setOtherRead(r.otherLastReadAt);
      } catch {
        /* offline — try again next tick */
      }
    };
    const id = setInterval(tick, 4000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [threadId]);

  async function send(confirmed = false) {
    const body = text.trim();
    if (!body) return;
    // Security prompt: stop and double-check messages that look like scams or contain sensitive data.
    const found = messageRisks(body);
    if (found.length && !confirmed) {
      setRisks(found);
      return;
    }
    setRisks(null);
    setSending(true);
    setError(null);
    try {
      const r = await api<{ message: Msg }>(`/threads/${threadId}/messages`, { body: { body } });
      setMessages((m) => [...m, r.message]);
      last.current = r.message.createdAt;
      setText("");
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Message not sent — check your connection.");
    } finally {
      setSending(false);
    }
  }

  const lastMine = [...messages].reverse().find((m) => m.senderId === me);
  return (
    <div className="flex h-[min(70dvh,680px)] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6" aria-live="polite">
        {messages.map((m) => {
          const mine = m.senderId === me;
          if (m.kind === "system")
            return (
              <p key={m.id} className="mx-auto flex max-w-md items-center justify-center gap-1.5 rounded-full bg-sand px-4 py-1.5 text-center text-xs font-semibold text-muted">
                <Info className="size-3.5" /> {m.body}
              </p>
            );
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[82%] rounded-2xl px-4 py-2.5 text-[15px] shadow-sm", mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-white ring-1 ring-line", m.kind !== "text" && (mine ? "bg-leaf" : "bg-highlight-soft ring-highlight/40"))}>
                {!mine && <p className="mb-0.5 text-xs font-bold text-leaf">{names[m.senderId] ?? "Member"}</p>}
                {m.kind === "rfq" && (
                  <p className="mb-1 flex items-center gap-1 text-xs font-bold tracking-wide uppercase opacity-80">
                    <FileText className="size-3.5" /> Request for quote
                  </p>
                )}
                {m.kind === "quote" && (
                  <p className="mb-1 flex items-center gap-1 text-xs font-bold tracking-wide uppercase opacity-80">
                    <BadgeDollarSign className="size-3.5" /> Quote
                  </p>
                )}
                <p className="whitespace-pre-line">{m.body}</p>
                {!mine && m.kind === "text" && <ReaderWarning body={m.body} />}
                <p className={cn("mt-1 text-[11px]", mine ? "text-white/60" : "text-muted")}>
                  {formatDateTime(m.createdAt)}
                  {mine && m.id === lastMine?.id && otherRead && new Date(otherRead) >= new Date(m.createdAt) && (
                    <span className="ml-1 inline-flex items-center gap-0.5">
                      <CheckCheck className="size-3" /> Seen
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {risks && (
        <div className="border-t border-danger/30 bg-danger-soft p-3 text-sm" role="alertdialog" aria-labelledby="risk-title">
          <p id="risk-title" className="flex items-center gap-1.5 font-bold text-danger">
            <ShieldAlert className="size-4" /> Before you send: this message {risks.map((r) => r.label).join(" and ")}.
          </p>
          <p className="mt-1 text-ink-soft">Never share passwords, card or bank details, or your SIN in chat. AGRI HUB will never ask you to pay or verify your account in a message. Agree payment terms on an invoice with someone you trust.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => setRisks(null)} className="min-h-11 rounded-full bg-primary px-4 font-semibold text-white">
              Edit message
            </button>
            <button type="button" onClick={() => send(true)} className="min-h-11 rounded-full px-4 font-semibold text-danger ring-1 ring-danger/40">
              Send anyway
            </button>
          </div>
        </div>
      )}
      <p className="flex items-center gap-1.5 border-t border-line bg-sand/50 px-4 py-1.5 text-xs text-muted">
        <Lock className="size-3.5 shrink-0" /> Stay safe: AGRI HUB never asks for passwords or payment in chat. Don&apos;t share bank or card details.
      </p>
      <form
        className="flex items-end gap-2 border-t border-line bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (risks) setRisks(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={4000}
          className="input max-h-40 min-h-11 flex-1 resize-none rounded-2xl!"
          placeholder="Type a message…"
          aria-label="Message"
        />
        <button disabled={sending || !text.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-white hover:bg-leaf disabled:opacity-40" aria-label="Send">
          <Send className="size-5" />
        </button>
      </form>
      {error && <p className="px-4 pb-2 text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
