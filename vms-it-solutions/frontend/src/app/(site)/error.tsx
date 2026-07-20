"use client";

import { useEffect } from "react";
import { PageHero } from "@/components/site/PageHero";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <PageHero eyebrow="Error" title="Something went wrong" subtitle="This page hit an unexpected error. Try again, or head back to the homepage." />
      <section className="relative py-16">
        <div className="relative mx-auto flex max-w-6xl gap-3 px-5">
          <button onClick={() => reset()} className="btn-brand rounded-lg px-5 py-2.5 text-sm font-semibold text-white">
            Try again
          </button>
          <a href="/" className="glass hover-glow rounded-lg px-5 py-2.5 text-sm font-medium text-fg">
            Back to homepage
          </a>
        </div>
      </section>
    </>
  );
}
