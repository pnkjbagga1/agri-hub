"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <div>
        <p className="eyebrow text-leaf!">Something went wrong</p>
        <h1 className="mt-2 text-3xl">We hit a rough patch.</h1>
        <p className="mt-3 text-muted">Please try again. If it keeps happening, contact support@griscanada.org.</p>
        <button onClick={reset} className="mt-6 rounded-full bg-primary px-6 py-3 font-semibold text-white">
          Try again
        </button>
      </div>
    </div>
  );
}
