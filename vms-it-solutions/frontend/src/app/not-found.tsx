import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-ink px-5 text-center text-white">
      <div>
        <p className="font-mono-x text-xs uppercase tracking-widest text-slate-x">404</p>
        <h1 className="mt-3 font-display text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-slate-x">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft">
          Back to homepage
        </Link>
      </div>
    </main>
  );
}
