/* Public site sections. Server-renderable except where marked "use client". */
import Link from "next/link";

export interface MenuItem { id: string; label: string; url: string }
export interface Company { companyName?: string; shortName?: string; tagline?: string; email?: string | null; phone?: string | null; whatsapp?: string | null; city?: string | null; workingHours?: string | null }
export interface SiteLogo { kind: string; url: string; thumbUrl: string | null }
export interface LogoSettings { headerLogoHeight: number; footerLogoHeight: number; mobileLogoHeight: number }

export function pickLogo(logos: SiteLogo[], ...kinds: string[]): SiteLogo | undefined {
  for (const k of kinds) {
    const found = logos.find((l) => l.kind === k);
    if (found) return found;
  }
  return undefined;
}
export interface Product { id: string; name: string; slug: string; shortDesc?: string | null }
export interface Service { id: string; name: string; slug: string; shortDesc?: string | null }
export interface Testimonial { id: string; name: string; company?: string | null; role?: string | null; content: string }
export interface Faq { id: string; question: string; answer: string }

/* ─────────────── Hero: ERP module node graph ─────────────── */
const NODES = [
  { id: "acc", label: "Accounting", x: 340, y: 60 },
  { id: "inv", label: "Inventory", x: 120, y: 150 },
  { id: "mfg", label: "Manufacturing", x: 250, y: 260 },
  { id: "sal", label: "Sales", x: 560, y: 130 },
  { id: "pur", label: "Purchase", x: 90, y: 330 },
  { id: "hr", label: "HR & Payroll", x: 520, y: 320 },
  { id: "crm", label: "CRM", x: 640, y: 230 },
];
const EDGES: [string, string][] = [
  ["acc", "inv"], ["acc", "sal"], ["inv", "mfg"], ["inv", "pur"],
  ["mfg", "hr"], ["sal", "crm"], ["mfg", "acc"], ["hr", "acc"],
];

function ModuleGraph() {
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  return (
    <svg viewBox="0 0 760 400" className="h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id="haze" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#2d5bff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#2d5bff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="760" height="400" fill="url(#haze)" />
      {EDGES.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={byId[a].x} y1={byId[a].y} x2={byId[b].x} y2={byId[b].y}
          stroke="#2d5bff" strokeOpacity="0.55" strokeWidth="1.4" className="flow-line"
        />
      ))}
      {NODES.map((n, i) => (
        <g key={n.id} className="node-glow" style={{ animationDelay: `${i * 0.4}s` }}>
          <circle cx={n.x} cy={n.y} r="26" fill="#0d1322" stroke="#2d5bff" strokeOpacity="0.7" strokeWidth="1.4" />
          <circle cx={n.x} cy={n.y} r="5" fill="#22d3ee" />
          <text
            x={n.x} y={n.y + 44} textAnchor="middle"
            fill="#8a94a8" fontSize="11" fontFamily="var(--font-jetbrains)" letterSpacing="0.08em"
          >
            {n.label.toUpperCase()}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function Hero({ company }: { company: Company }) {
  return (
    <section className="relative overflow-hidden bg-ink pb-24 pt-36 text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
        <div>
          <p className="eyebrow text-cyan-x">ERPNext · SAP Business One · Mumbai, India</p>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Every department.
            <br />
            One system.
            <br />
            <span className="text-cobalt-soft">Live in 8–16 weeks.</span>
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-slate-x">
            {company.tagline
              ? `${company.companyName ?? "VMS IT Solutions"} — ${company.tagline}.`
              : "VMS IT Solutions implements and supports ERP for mid-market manufacturers and distributors — fixed scope, fixed timeline, GST-ready from day one."}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/book-demo" className="rounded-lg bg-cobalt px-6 py-3 text-sm font-semibold text-white transition hover:bg-cobalt-soft">
              Book a live demo
            </Link>
            <Link href="/services" className="rounded-lg border border-line px-6 py-3 text-sm font-semibold text-slate-x transition hover:border-cobalt hover:text-white">
              Explore services
            </Link>
          </div>
          <p className="mt-8 font-mono-x text-xs text-slate-x">
            120+ go-lives · 14 industries · 99.9% hosted uptime
          </p>
        </div>
        <div className="hidden h-[400px] lg:block">
          <ModuleGraph />
        </div>
      </div>
    </section>
  );
}

/* ─────────────── Products grid ─────────────── */
export function ProductsSection({ products }: { products: Product[] }) {
  return (
    <section className="bg-paper py-24" id="products">
      <div className="mx-auto max-w-6xl px-5">
        <p className="eyebrow text-cobalt">Products</p>
        <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold tracking-tight text-ink">
          The modules your operation actually runs on
        </h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/products#${p.slug}`}
              className="group rounded-xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-cobalt/50 hover:shadow-lg hover:shadow-cobalt/5"
            >
              <h3 className="font-display text-[17px] font-semibold text-ink group-hover:text-cobalt">{p.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{p.shortDesc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── Services ─────────────── */
export function ServicesSection({ services }: { services: Service[] }) {
  return (
    <section className="bg-white py-24" id="services">
      <div className="mx-auto max-w-6xl px-5">
        <p className="eyebrow text-cobalt">Services</p>
        <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold tracking-tight text-ink">
          From first workshop to years of support
        </h2>
        <div className="mt-12 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {services.map((s) => (
            <Link key={s.id} href={`/services#${s.slug}`} className="group flex gap-4 border-l-2 border-cobalt/30 pl-5">
              <div>
                <h3 className="font-display text-base font-semibold text-ink group-hover:text-cobalt">{s.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.shortDesc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── Testimonials ─────────────── */
export function TestimonialsSection({ items }: { items: Testimonial[] }) {
  if (!items.length) return null;
  return (
    <section className="bg-ink py-24 text-white">
      <div className="mx-auto max-w-6xl px-5">
        <p className="eyebrow text-cyan-x">Client outcomes</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {items.map((t) => (
            <figure key={t.id} className="rounded-xl border border-line bg-ink-2 p-6">
              <blockquote className="text-sm leading-relaxed text-slate-300">“{t.content}”</blockquote>
              <figcaption className="mt-5">
                <div className="font-display text-sm font-semibold">{t.name}</div>
                <div className="font-mono-x text-[11px] uppercase tracking-widest text-slate-x">
                  {[t.role, t.company].filter(Boolean).join(" · ")}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── FAQ ─────────────── */
export function FaqSection({ items }: { items: Faq[] }) {
  if (!items.length) return null;
  return (
    <section className="bg-paper py-24">
      <div className="mx-auto max-w-3xl px-5">
        <p className="eyebrow text-cobalt">Questions we hear in every first call</p>
        <div className="mt-8 divide-y divide-slate-200">
          {items.map((f) => (
            <details key={f.id} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-display text-[15px] font-semibold text-ink">
                {f.question}
                <span className="ml-4 text-cobalt transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── Footer ─────────────── */
export function Footer({ company, menu, logos = [], logoSettings }: { company: Company; menu: MenuItem[]; logos?: SiteLogo[]; logoSettings?: LogoSettings | null }) {
  const footerLogo = pickLogo(logos, "footer", "dark", "primary");
  return (
    <footer className="border-t border-line bg-ink py-14 text-slate-x">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-3">
        <div>
          {footerLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={footerLogo.url} alt={company.companyName ?? "Logo"} style={{ height: logoSettings?.footerLogoHeight ?? 32, width: "auto" }} className="mb-3 object-contain" />
          )}
          <div className="font-display text-base font-semibold text-white">{company.companyName ?? "VMS IT Solutions"}</div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed">
            ERP implementation, customisation and managed support for manufacturing and distribution companies.
          </p>
        </div>
        <div>
          <div className="eyebrow text-slate-x">Company</div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {menu.map((m) => (
              <li key={m.id}><Link href={m.url} className="hover:text-white">{m.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="eyebrow text-slate-x">Reach us</div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {company.email && <li><a href={`mailto:${company.email}`} className="hover:text-white">{company.email}</a></li>}
            {company.phone && <li><a href={`tel:${company.phone.replace(/[^+\d]/g, "")}`} className="hover:text-white">{company.phone}</a></li>}
            {company.whatsapp && (
              <li>
                <a href={`https://wa.me/${company.whatsapp.replace(/[^\d]/g, "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  WhatsApp — {company.whatsapp}
                </a>
              </li>
            )}
            {company.workingHours && <li>{company.workingHours}</li>}
            {company.city && <li>{company.city}, India</li>}
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-line px-5 pt-6 font-mono-x text-[11px] uppercase tracking-widest">
        © {new Date().getFullYear()} {company.companyName ?? "VMS IT Solutions"} · All rights reserved
      </div>
    </footer>
  );
}
