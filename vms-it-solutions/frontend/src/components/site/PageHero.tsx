export function PageHero({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <section className="relative overflow-hidden pb-10 pt-28 text-fg">
      <div className="glow-orb -left-20 -top-20 h-72 w-72 bg-iris/35" />
      <div className="glow-orb -right-16 top-10 h-64 w-64 bg-aqua/20" />
      <div className="relative mx-auto max-w-6xl animate-fade-in-up px-5">
        {eyebrow && <p className="eyebrow text-aqua">{eyebrow}</p>}
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-mist">{subtitle}</p>}
      </div>
    </section>
  );
}
