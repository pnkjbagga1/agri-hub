"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarCheck, Heart, MessageSquare, Send, Star, HandHeart, ShieldQuestion } from "lucide-react";
import { Button, buttonClass, Notice } from "@/components/ui";
import { Field, FormError, Modal } from "@/components/forms";
import { api, ClientApiError } from "@/lib/client";
import { cn } from "@/lib/utils";

const errMsg = (e: unknown) => (e instanceof ClientApiError ? e.message : "Something went wrong.");

function SignInFirst({ next, label }: { next: string; label: string }) {
  return (
    <Link href={`/login?next=${encodeURIComponent(next)}`} className={buttonClass("primary", "lg")}>
      {label}
    </Link>
  );
}

/** Message a member directly from their profile. */
export function ContactButton({ recipientId, name, signedIn, next, disabled }: { recipientId: string; name: string; signedIn: boolean; next: string; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!signedIn) return <SignInFirst next={next} label="Sign in to connect" />;
  if (disabled) return null;
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <MessageSquare className="size-5" /> Connect / Message
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Message ${name}`}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const r = await api<{ threadId: string }>("/threads", { body: { recipientId, body: new FormData(e.currentTarget).get("body") } });
              router.push(`/messages/${r.threadId}`);
            } catch (err) {
              setError(errMsg(err));
              setBusy(false);
            }
          }}
        >
          <FormError message={error} />
          <textarea name="body" rows={5} required maxLength={4000} className="input" placeholder="Introduce yourself and what you're looking for…" />
          <Button className="w-full" size="lg" disabled={busy}>
            <Send className="size-4" /> {busy ? "Sending…" : "Send message"}
          </Button>
        </form>
      </Modal>
    </>
  );
}

/** Request ownership of an unclaimed directory profile. */
export function ClaimButton({ profileId, signedIn, next }: { profileId: string; signedIn: boolean; next: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!signedIn)
    return (
      <Link href={`/partners/login?next=${encodeURIComponent(next)}`} className={buttonClass("outline", "md")}>
        <ShieldQuestion className="size-4" /> Is this your organisation? Claim it
      </Link>
    );
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ShieldQuestion className="size-4" /> Claim this profile
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Claim this profile">
        {done ? (
          <Notice tone="success">Request sent. GRIS Canada will verify your connection to the organisation (usually via your work email) and transfer the profile.</Notice>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/reports", { body: { targetType: "claim", targetId: profileId, reason: "Profile claim", details: new FormData(e.currentTarget).get("details") } });
                setDone(true);
              } catch (err) {
                setError(errMsg(err));
              }
            }}
          >
            <FormError message={error} />
            <Field label="Your role at the organisation & work email" required>
              <textarea name="details" rows={4} required maxLength={1000} className="input" placeholder="e.g. Program manager, jane.doe@organisation.ca" />
            </Field>
            <Button className="w-full">Send claim request</Button>
          </form>
        )}
      </Modal>
    </>
  );
}

export function ReviewForm({ subjectId, name }: { subjectId: string; name: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Star className="size-4" /> Write a review
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Review ${name}`}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("/reviews", { body: { subjectId, rating, body: new FormData(e.currentTarget).get("body") } });
              setOpen(false);
              router.refresh();
            } catch (err) {
              setError(errMsg(err));
            }
          }}
        >
          <FormError message={error} />
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} stars`} onClick={() => setRating(i)}>
                <Star className={cn("size-8", i <= rating ? "fill-highlight text-highlight" : "text-line")} />
              </button>
            ))}
          </div>
          <textarea name="body" rows={4} maxLength={2000} className="input" placeholder="Quality, communication, delivery…" />
          <Button className="w-full">Post review</Button>
        </form>
      </Modal>
    </>
  );
}

/** One-click "express interest" for a partner program, with optional message. */
export function InterestButton({ resourceId, signedIn, next, already, externalUrl }: { resourceId: string; signedIn: boolean; next: string; already: boolean; externalUrl: string | null }) {
  const [state, setState] = useState<"idle" | "open" | "done">(already ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);
  if (!signedIn) return <SignInFirst next={next} label="Sign in to express interest" />;
  if (state === "done")
    return (
      <div className="space-y-3">
        <Notice tone="success">You&apos;ve expressed interest — the partner can now see your profile and reach out.</Notice>
        {externalUrl && (
          <a href={externalUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "md")}>
            Official program page ↗
          </a>
        )}
      </div>
    );
  return (
    <>
      <Button size="lg" onClick={() => setState("open")}>
        <HandHeart className="size-5" /> Express interest
      </Button>
      <Modal open={state === "open"} onClose={() => setState("idle")} title="Express interest">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api(`/resources/${resourceId}`, { body: { message: new FormData(e.currentTarget).get("message") } });
              setState("done");
            } catch (err) {
              setError(errMsg(err));
            }
          }}
        >
          <FormError message={error} />
          <Field label="Message (optional)" hint="Your profile is shared with the partner.">
            <textarea name="message" rows={4} maxLength={1500} className="input" placeholder="Tell them about your operation and what you need." />
          </Field>
          <Button className="w-full" size="lg">
            Send
          </Button>
        </form>
      </Modal>
    </>
  );
}

export function RsvpButton({ eventId, going: initial, count: initialCount, signedIn, next, full, past }: { eventId: string; going: boolean; count: number; signedIn: boolean; next: string; full: boolean; past: boolean }) {
  const [going, setGoing] = useState(initial);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  if (past) return <p className="text-muted">This event has ended.</p>;
  if (!signedIn) return <SignInFirst next={next} label="Sign in to RSVP" />;
  return (
    <div>
      <Button
        size="lg"
        variant={going ? "secondary" : "primary"}
        disabled={full && !going}
        onClick={async () => {
          setError(null);
          try {
            const r = await api<{ going: boolean; count: number }>(`/events/${eventId}`, { body: {} });
            setGoing(r.going);
            setCount(r.count);
          } catch (e) {
            setError(errMsg(e));
          }
        }}
      >
        <CalendarCheck className="size-5" /> {going ? "You're going ✓ (cancel)" : full ? "Event full" : "RSVP — I'll attend"}
      </Button>
      <p className="mt-2 text-sm text-muted">{count} attending</p>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function LikeButton({ postId, liked: initial, count: initialCount, signedIn }: { postId: string; liked: boolean; count: number; signedIn: boolean }) {
  const [liked, setLiked] = useState(initial);
  const [count, setCount] = useState(initialCount);
  return (
    <button
      disabled={!signedIn}
      onClick={async () => {
        setLiked(!liked);
        setCount(count + (liked ? -1 : 1));
        try {
          const r = await api<{ liked: boolean; count: number }>(`/posts/${postId}`, { body: { action: "react" } });
          setLiked(r.liked);
          setCount(r.count);
        } catch {
          setLiked(liked);
          setCount(count);
        }
      }}
      className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition", liked ? "bg-danger-soft text-danger" : "text-muted hover:bg-sand")}
      aria-pressed={liked}
      title={signedIn ? undefined : "Sign in to react"}
    >
      <Heart className={cn("size-4", liked && "fill-danger")} /> {count}
    </button>
  );
}

export function CommentForm({ postId }: { postId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setError(null);
        try {
          await api(`/posts/${postId}`, { body: { action: "comment", body: new FormData(form).get("body") } });
          form.reset();
          router.refresh();
        } catch (err) {
          setError(errMsg(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <input name="body" required maxLength={3000} className="input rounded-full!" placeholder="Write a comment…" aria-label="Comment" />
      <Button disabled={busy}>Reply</Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}

export function PostComposer({ spaces, defaultSpaceId }: { spaces: { id: string; name: string }[]; defaultSpaceId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button onClick={() => setOpen(true)} className="card w-full p-4 text-left text-muted hover:border-primary/40">
        Start a discussion — ask a question, share a result, post an opportunity…
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New discussion" wide>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              const r = await api<{ id: string }>("/posts", { body: { spaceId: f.get("spaceId"), title: f.get("title"), body: f.get("body") } });
              router.push(`/community/post/${r.id}`);
            } catch (err) {
              setError(errMsg(err));
            }
          }}
        >
          <FormError message={error} />
          <Field label="Space">
            <select name="spaceId" defaultValue={defaultSpaceId} className="input">
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input name="title" maxLength={160} className="input" />
          </Field>
          <Field label="Post" required>
            <textarea name="body" rows={6} required maxLength={8000} className="input" />
          </Field>
          <Button className="w-full" size="lg">
            Post to community
          </Button>
        </form>
      </Modal>
    </>
  );
}

export function OfferToSupply({ demandId, signedIn, canOffer, next }: { demandId: string; signedIn: boolean; canOffer: boolean; next: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!signedIn) return <SignInFirst next={next} label="Sign in to offer supply" />;
  if (!canOffer) return <p className="text-sm text-muted">Only growers and suppliers can respond to demand posts.</p>;
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <Send className="size-5" /> Offer to supply
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Offer to supply">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const r = await api<{ threadId: string }>(`/demand/${demandId}`, { body: { message: new FormData(e.currentTarget).get("message") } });
              router.push(`/messages/${r.threadId}`);
            } catch (err) {
              setError(errMsg(err));
            }
          }}
        >
          <FormError message={error} />
          <textarea name="message" rows={5} required minLength={5} maxLength={3000} className="input" placeholder="Volume you can supply, price, timing, certifications, link to your listing…" />
          <Button className="w-full" size="lg">
            Send offer
          </Button>
        </form>
      </Modal>
    </>
  );
}
