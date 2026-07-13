import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";

export const metadata: Metadata = { title: "Page not found" };

export default function SiteNotFound() {
  return (
    <>
      <PageHero eyebrow="404" title="Page not found" subtitle="The page you're looking for doesn't exist or has moved." />
      <section className="relative py-16">
        <div className="relative mx-auto max-w-6xl px-5">
          <Link href="/" className="btn-brand inline-block rounded-lg px-5 py-2.5 text-sm font-semibold text-white">
            Back to homepage
          </Link>
        </div>
      </section>
    </>
  );
}
