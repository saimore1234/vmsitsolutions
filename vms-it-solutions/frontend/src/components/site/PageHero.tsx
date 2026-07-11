export function PageHero({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <section className="bg-ink pb-16 pt-32 text-white">
      <div className="mx-auto max-w-6xl animate-fade-in-up px-5">
        {eyebrow && <p className="eyebrow text-cyan-x">{eyebrow}</p>}
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-x">{subtitle}</p>}
      </div>
    </section>
  );
}
