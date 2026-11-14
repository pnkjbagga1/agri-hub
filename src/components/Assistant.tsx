"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircleQuestion, Send, Sparkles, X } from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

type Turn = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = ["Who sells blueberries in Abbotsford?", "Which programs help with exporting?", "Find Buy BC apple cider makers", "How do I request a quote?"];
const GREETING: Turn = {
  role: "assistant",
  content: "Hi! I'm the AGRI HUB Assistant. Ask me about BC produce, growers and buyers, Buy BC products, funding programs or events — or how to use the hub.",
};

/** Inline renderer for the assistant's light markdown: internal links, **bold**, bullet lists. Everything else is plain text. */
function Rich({ text }: { text: string }) {
  const inline = (s: string, key: string): ReactNode[] => {
    const out: ReactNode[] = [];
    const re = /\[([^\]]{1,160})\]\(([^)\s]{1,300})\)|\*\*([^*]{1,200})\*\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push(s.slice(last, m.index));
      if (m[1] && m[2]) {
        const href = m[2];
        if (href.startsWith("/") && !href.startsWith("//")) {
          out.push(
            <Link key={`${key}-${i++}`} href={href} className="font-semibold text-leaf underline underline-offset-2">
              {m[1]}
            </Link>,
          );
        } else if (/^https:\/\//.test(href)) {
          out.push(
            <a key={`${key}-${i++}`} href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-leaf underline underline-offset-2">
              {m[1]}
            </a>,
          );
        } else out.push(m[1]);
      } else if (m[3]) out.push(<strong key={`${key}-${i++}`}>{m[3]}</strong>);
      last = m.index + m[0].length;
    }
    if (last < s.length) out.push(s.slice(last));
    return out;
  };
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${k}`} className="my-1.5 list-disc space-y-1 pl-5">
        {list.map((l, j) => (
          <li key={j}>{inline(l, `li-${k}-${j}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  text.split("\n").forEach((line, k) => {
    const b = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (b) return void list.push(b[1]!);
    flush(k);
    const h = line.replace(/^#{1,4}\s+/, "");
    if (h.trim()) blocks.push(<p key={`p-${k}`} className="my-1">{inline(h, `p-${k}`)}</p>);
  });
  flush(-1);
  return <Fragment>{blocks}</Fragment>;
}

export function Assistant() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"ai" | "search" | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const path = usePathname();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy, open]);

  if (path?.startsWith("/admin")) return null;

  async function ask(q: string) {
    const question = q.trim().slice(0, 2000);
    if (!question || busy) return;
    const next = [...turns, { role: "user" as const, content: question }];
    setTurns(next);
    setInput("");
    setBusy(true);
    try {
      const res = await api<{ reply: string; mode: "ai" | "search" }>("/assistant", { body: { messages: next.filter((t) => t !== GREETING).slice(-12) } });
      setMode(res.mode);
      setTurns([...next, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setTurns([...next, { role: "assistant", content: e instanceof Error ? e.message : "Sorry, something went wrong. Please try again." }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="agrihub-assistant"
        className={cn(
          "fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 font-semibold text-white shadow-lg ring-1 ring-black/10 transition hover:bg-primary/90 sm:right-6 sm:bottom-6",
          open && "max-sm:hidden",
        )}
      >
        {open ? <X className="size-5" /> : <MessageCircleQuestion className="size-5" />}
        <span className="text-sm">{open ? "Close" : "Ask AGRI HUB"}</span>
      </button>

      {open && (
        <section
          id="agrihub-assistant"
          role="dialog"
          aria-label="AGRI HUB Assistant"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col overflow-hidden rounded-t-[22px] border border-line bg-cream shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-24 sm:h-[600px] sm:max-h-[calc(100dvh-8rem)] sm:w-[400px] sm:rounded-[22px]"
        >
          <header className="flex items-center gap-3 bg-primary px-4 py-3 text-white">
            <span className="grid size-9 place-items-center rounded-full bg-white/15">
              <Sparkles className="size-5 text-highlight" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base leading-tight font-black">AGRI HUB Assistant</p>
              <p className="text-xs text-white/70">{mode === "search" ? "Hub search mode" : "AI answers from live hub data"}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full hover:bg-white/15" aria-label="Close assistant">
              <X className="size-5" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm leading-relaxed" aria-live="polite">
            {turns.map((t, i) => (
              <div key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[88%] rounded-2xl px-3.5 py-2.5 break-words", t.role === "user" ? "rounded-br-md bg-primary text-white" : "rounded-bl-md border border-line bg-white text-ink")}>
                  {t.role === "assistant" ? <Rich text={t.content} /> : t.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="flex gap-1 rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3" aria-label="Assistant is typing">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}
            {turns.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-line bg-white px-3 py-1.5 text-left text-xs font-semibold text-ink-soft hover:border-primary hover:text-primary">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-end gap-2 border-t border-line bg-white p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
          >
            <label className="sr-only" htmlFor="assistant-input">
              Ask a question
            </label>
            <textarea
              id="assistant-input"
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={2000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(input);
                }
              }}
              placeholder="Ask about produce, suppliers, programs…"
              className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-cream px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button type="submit" disabled={busy || !input.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-white disabled:opacity-40" aria-label="Send">
              <Send className="size-4" />
            </button>
          </form>
          <p className="bg-white px-3 pb-2 text-center text-[10px] text-muted">Answers use public hub data and may be incomplete. Confirm details with the business.</p>
        </section>
      )}
    </>
  );
}
