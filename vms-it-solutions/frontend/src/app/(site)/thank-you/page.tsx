import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";

export const metadata: Metadata = { title: "Thank You" };

export default function ThankYouPage() {
  return (
    <>
      <PageHero eyebrow="Thank you" title="Your enquiry has been submitted successfully" subtitle="Our team will reach out within one business day." />
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
