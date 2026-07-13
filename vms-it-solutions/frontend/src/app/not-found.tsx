import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function RootNotFound() {
  return (
    <main className="site-bg grid min-h-screen place-items-center px-5 text-center text-white">
      <div className="glass animate-scale-in rounded-2xl p-10">
        <p className="font-mono-x text-xs uppercase tracking-widest text-aqua">404</p>
        <h1 className="mt-3 font-display text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-haze">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <Link href="/" className="btn-brand mt-6 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold text-white">
          Back to homepage
        </Link>
      </div>
    </main>
  );
}
