"use client";

import { useRef, useState } from "react";
import type { Faq } from "./sections";

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const [maxHeight, setMaxHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    setMaxHeight(next && contentRef.current ? contentRef.current.scrollHeight + 4 : 0);
  }

  return (
    <div className="glass hover-glow rounded-xl px-5 py-4">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 text-left font-display text-[15px] font-semibold text-fg"
      >
        {question}
        <span
          className={`btn-brand grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs text-white transition-transform duration-300 ease-out ${open ? "rotate-45" : ""}`}
        >
          +
        </span>
      </button>
      <div
        className="overflow-hidden"
        style={{ maxHeight, opacity: open ? 1 : 0, transition: "max-height 0.35s var(--ease-out), opacity 0.3s var(--ease-out)" }}
      >
        {/* padding (not margin) on the measured element — margin-top isn't included in scrollHeight,
            which was causing the last line of every answer to get clipped by the max-height cap. */}
        <div ref={contentRef} className="pt-3">
          <p className="text-sm leading-relaxed text-haze">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqAccordion({ items }: { items: Faq[] }) {
  return (
    <div className="mt-6 space-y-3">
      {items.map((f) => (
        <FaqItem key={f.id} question={f.question} answer={f.answer} />
      ))}
    </div>
  );
}
