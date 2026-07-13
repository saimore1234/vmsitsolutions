/* Public site sections. Server-renderable except where marked "use client". */
import Link from "next/link";
import { Reveal } from "./Reveal";
import { FaqAccordion } from "./FaqAccordion";
import { TestimonialsCarousel } from "./TestimonialsCarousel";

export interface MenuItem { id: string; label: string; url: string }
export interface Company {
  companyName?: string; shortName?: string; tagline?: string; email?: string | null;
  phone?: string | null; mobile?: string | null; supportEmail?: string | null; salesEmail?: string | null;
  whatsapp?: string | null; city?: string | null; workingHours?: string | null;
}
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
    <svg viewBox="0 0 760 400" className="module-graph h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id="haze" cx="50%" cy="45%" r="60%">
          <stop offset="0%" style={{ stopColor: "var(--graph-glow)" }} />
          <stop offset="100%" style={{ stopColor: "var(--graph-glow)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <rect width="760" height="400" fill="url(#haze)" />
      {EDGES.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={byId[a].x} y1={byId[a].y} x2={byId[b].x} y2={byId[b].y}
          stroke="var(--graph-line)" strokeWidth="1.4" className="flow-line"
        />
      ))}
      {NODES.map((n, i) => (
        <g key={n.id} className="node-glow" style={{ animationDelay: `${i * 0.4}s` }}>
          <circle cx={n.x} cy={n.y} r="26" fill="var(--graph-node-fill)" stroke="var(--graph-node-stroke)" strokeWidth="1.4" />
          <circle cx={n.x} cy={n.y} r="5" fill="var(--color-aqua)" />
          <text
            x={n.x} y={n.y + 44} textAnchor="middle"
            fill="var(--color-haze)" fontSize="11" fontFamily="var(--font-jetbrains)" letterSpacing="0.08em"
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
    <section className="relative overflow-hidden pb-14 pt-24 text-fg">
      <div className="glow-orb -left-32 -top-32 h-96 w-96 bg-iris/40" />
      <div className="glow-orb -right-24 top-20 h-80 w-80 bg-aqua/25" />
      <div className="grid-texture absolute inset-0" />
      <div className="relative mx-auto grid max-w-6xl animate-fade-in-up items-center gap-10 px-5 lg:grid-cols-2">
        <div>
          <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-aqua">
            ERPNext · SAP Business One · Mumbai, India
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Every department.
            <br />
            One system.
            <br />
            <span className="text-gradient">Live in 8–16 weeks.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-mist">
            {company.tagline
              ? `${company.companyName ?? "VMS IT Solutions"} — ${company.tagline}.`
              : "VMS IT Solutions implements and supports ERP for mid-market manufacturers and distributors — fixed scope, fixed timeline, GST-ready from day one."}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link href="/book-demo" className="btn-brand rounded-lg px-6 py-3 text-sm font-semibold text-white">
              Book a live demo
            </Link>
            <Link href="/services" className="glass hover-glow rounded-lg px-6 py-3 text-sm font-semibold text-mist hover:-translate-y-0.5 hover:text-fg active:translate-y-0 active:scale-95">
              Explore services
            </Link>
          </div>
          <p className="mt-6 font-mono-x text-xs text-haze">
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
    <section className="relative py-14" id="products">
      <div className="relative mx-auto max-w-6xl px-5">
        <Reveal>
          <p className="eyebrow text-aqua">Products</p>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold tracking-tight text-fg">
            The modules your operation actually runs on
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => (
            <Reveal key={p.id} delayMs={Math.min(i, 5) * 60}>
              <Link
                href={`/products#${p.slug}`}
                className="group glass block rounded-xl p-6 hover-glow hover:-translate-y-1"
              >
                <h3 className="font-display text-[17px] font-semibold text-fg transition-colors group-hover:text-gradient">{p.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-haze">{p.shortDesc}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── Services ─────────────── */
export function ServicesSection({ services }: { services: Service[] }) {
  return (
    <section className="relative py-14" id="services">
      <div className="relative mx-auto max-w-6xl px-5">
        <Reveal>
          <p className="eyebrow text-aqua">Services</p>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold tracking-tight text-fg">
            From first workshop to years of support
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {services.map((s, i) => (
            <Reveal key={s.id} delayMs={Math.min(i, 5) * 60}>
              <Link href={`/services#${s.slug}`} className="group glass flex gap-4 rounded-xl p-5 hover-glow hover:-translate-y-1">
                <span className="btn-brand mt-1 h-2 w-2 shrink-0 rounded-full" />
                <div>
                  <h3 className="font-display text-base font-semibold text-fg transition-colors group-hover:text-gradient">{s.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-haze">{s.shortDesc}</p>
                </div>
              </Link>
            </Reveal>
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
    <section className="relative py-14 text-fg">
      <div className="relative mx-auto max-w-3xl px-5">
        <Reveal><p className="eyebrow text-center text-aqua">Client outcomes</p></Reveal>
        <div className="mt-8">
          <TestimonialsCarousel items={items} />
        </div>
      </div>
    </section>
  );
}

/* ─────────────── FAQ ─────────────── */
export function FaqSection({ items }: { items: Faq[] }) {
  if (!items.length) return null;
  return (
    <section className="relative py-14">
      <div className="relative mx-auto max-w-3xl px-5">
        <Reveal><p className="eyebrow text-aqua">Questions we hear in every first call</p></Reveal>
        <FaqAccordion items={items} />
      </div>
    </section>
  );
}

/* ─────────────── Footer ─────────────── */
export function Footer({ company, menu, logos = [], logoSettings }: { company: Company; menu: MenuItem[]; logos?: SiteLogo[]; logoSettings?: LogoSettings | null }) {
  const footerLogo = pickLogo(logos, "footer", "dark", "primary");
  return (
    <footer className="glass-strong relative border-t border-white/10 py-10 text-haze">
      <div className="relative mx-auto grid max-w-6xl gap-8 px-5 md:grid-cols-3">
        <div>
          {footerLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={footerLogo.url} alt={company.companyName ?? "Logo"} style={{ height: logoSettings?.footerLogoHeight ?? 32, width: "auto" }} className="mb-3 object-contain" />
          )}
          <div className="font-display text-base font-semibold text-fg">{company.companyName ?? "VMS IT Solutions"}</div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed">
            ERP implementation, customisation and managed support for manufacturing and distribution companies.
          </p>
        </div>
        <div>
          <div className="eyebrow text-haze">Company</div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {menu.map((m) => (
              <li key={m.id}><Link href={m.url} className="transition-colors duration-200 ease-out hover:text-fg">{m.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="eyebrow text-haze">Reach us</div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {company.phone && (
              <li>Support — <a href={`tel:${company.phone.replace(/[^+\d]/g, "")}`} className="transition-colors duration-200 ease-out hover:text-fg">{company.phone}</a></li>
            )}
            {company.mobile && (
              <li>Sales — <a href={`tel:${company.mobile.replace(/[^+\d]/g, "")}`} className="transition-colors duration-200 ease-out hover:text-fg">{company.mobile}</a></li>
            )}
            {company.supportEmail && <li><a href={`mailto:${company.supportEmail}`} className="transition-colors duration-200 ease-out hover:text-fg">{company.supportEmail}</a></li>}
            {company.workingHours && <li>{company.workingHours}</li>}
            {company.city && <li>{company.city}, India</li>}
          </ul>
        </div>
      </div>
      <div className="relative mx-auto mt-8 max-w-6xl border-t border-white/10 px-5 pt-6 font-mono-x text-[11px] uppercase tracking-widest">
        © {new Date().getFullYear()} {company.companyName ?? "VMS IT Solutions"} · All rights reserved
      </div>
    </footer>
  );
}
