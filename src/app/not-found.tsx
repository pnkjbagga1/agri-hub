import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-[70dvh] place-items-center px-4 text-center">
      <div>
        <p className="eyebrow text-leaf!">404</p>
        <h1 className="mt-2 text-4xl">This field is empty.</h1>
        <p className="mt-3 text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="rounded-full bg-primary px-6 py-3 font-semibold text-white">
            Home
          </Link>
          <Link href="/marketplace" className="rounded-full bg-white px-6 py-3 font-semibold ring-1 ring-line">
            Marketplace
          </Link>
        </div>
      </div>
    </main>
  );
}
