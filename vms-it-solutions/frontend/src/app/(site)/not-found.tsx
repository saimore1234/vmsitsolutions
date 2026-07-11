import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";

export default function SiteNotFound() {
  return (
    <>
      <PageHero eyebrow="404" title="Page not found" subtitle="The page you're looking for doesn't exist or has moved." />
      <section className="bg-paper py-16">
        <div className="mx-auto max-w-6xl px-5">
          <Link href="/" className="rounded-lg bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-soft">
            Back to homepage
          </Link>
        </div>
      </section>
    </>
  );
}
