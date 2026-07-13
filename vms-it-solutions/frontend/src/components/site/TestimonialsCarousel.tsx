"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Testimonial } from "./sections";

const AUTO_ADVANCE_MS = 4500;

export function TestimonialsCarousel({ items }: { items: Testimonial[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const count = items.length;

  const go = useCallback((next: number) => {
    setIndex(((next % count) + count) % count);
  }, [count]);

  // Interval is created once per pause-state change (not per tick) and always advances off the
  // latest index via the functional setState form — avoids drift/stalling from stale closures.
  useEffect(() => {
    if (paused || count <= 1) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(t);
  }, [paused, count]);

  if (!items.length) return null;

  return (
    <div
      className="relative"
      role="region"
      aria-label="Customer testimonials"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="overflow-hidden rounded-2xl">
        <div
          ref={trackRef}
          className="flex"
          style={{ transform: `translateX(-${index * 100}%)`, transition: "transform 0.6s var(--ease-out)" }}
        >
          {items.map((t) => (
            <figure key={t.id} className="glass w-full shrink-0 rounded-2xl p-8 sm:p-10">
              <blockquote className="text-balance text-center font-display text-lg leading-relaxed text-fg sm:text-xl">
                “{t.content}”
              </blockquote>
              <figcaption className="mt-6 text-center">
                <div className="font-display text-sm font-semibold text-fg">{t.name}</div>
                <div className="font-mono-x text-[11px] uppercase tracking-widest text-haze">
                  {[t.role, t.company].filter(Boolean).join(" · ")}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous testimonial"
            className="glass hover-glow absolute left-0 top-1/2 hidden h-10 w-10 -translate-x-4 -translate-y-1/2 place-items-center rounded-full text-fg sm:grid"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 2 4 8l6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next testimonial"
            className="glass hover-glow absolute right-0 top-1/2 hidden h-10 w-10 -translate-y-1/2 translate-x-4 place-items-center rounded-full text-fg sm:grid"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 2l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>

          <div className="mt-6 flex items-center justify-center gap-2">
            {items.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to testimonial ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all duration-300 ease-out ${i === index ? "btn-brand w-6" : "w-1.5 bg-haze/40 hover:bg-haze/70"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
