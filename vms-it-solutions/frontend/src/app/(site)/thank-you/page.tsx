import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";

export const metadata: Metadata = { title: "Thank You" };

export default function ThankYouPage() {
  return (
    <>
      <PageHero eyebrow="Thank you" title="Your enquiry has been submitted successfully" subtitle="Our team will reach out within one business day." />
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
