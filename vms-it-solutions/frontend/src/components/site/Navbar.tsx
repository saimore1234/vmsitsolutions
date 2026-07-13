"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { pickLogo, type Company, type MenuItem, type SiteLogo, type LogoSettings } from "./sections";
import { ThemeToggle } from "./ThemeToggle";

function isActive(pathname: string, url: string) {
  if (url === "/") return pathname === "/";
  const path = url.split("#")[0];
  return path !== "" && (pathname === path || pathname.startsWith(`${path}/`));
}

export function Navbar({ company, menu, logos = [], logoSettings }: { company: Company; menu: MenuItem[]; logos?: SiteLogo[]; logoSettings?: LogoSettings | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const desktopLogo = pickLogo(logos, "dark", "primary");
  const mobileLogo = pickLogo(logos, "mobile", "dark", "primary");
  const headerHeight = logoSettings?.headerLogoHeight ?? 40;
  const mobileHeight = logoSettings?.mobileLogoHeight ?? 32;

  return (
    <header className="glass-strong fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5 transition-opacity duration-200 ease-out hover:opacity-80" onClick={() => setOpen(false)}>
          {desktopLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mobileLogo?.url ?? desktopLogo.url} alt={company.companyName ?? "Logo"} style={{ height: mobileHeight, width: "auto" }} className="object-contain sm:hidden" />
          ) : (
            <span className="btn-brand grid h-8 w-8 place-items-center rounded-lg font-display text-sm font-bold text-white sm:hidden">
              {(company.shortName ?? "V").slice(0, 1)}
            </span>
          )}
          {desktopLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={desktopLogo.url} alt={company.companyName ?? "Logo"} style={{ height: headerHeight, width: "auto" }} className="hidden object-contain sm:block" />
          ) : (
            <span className="btn-brand hidden h-8 w-8 place-items-center rounded-lg font-display text-sm font-bold text-white sm:grid">
              {(company.shortName ?? "V").slice(0, 1)}
            </span>
          )}
          <span className="font-display text-[15px] font-semibold tracking-tight text-fg">
            {company.companyName ?? "VMS IT Solutions"}
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {menu.map((item) => {
            const active = isActive(pathname, item.url);
            return (
              <Link
                key={item.id}
                href={item.url}
                className={`group relative py-1 text-[13px] font-medium transition-colors duration-300 ease-out ${active ? "text-fg" : "text-haze hover:text-fg"}`}
              >
                {item.label}
                <span
                  className={`btn-brand absolute -bottom-[19px] left-0 right-0 h-0.5 rounded-full transition-transform duration-300 ease-out ${active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle className="hidden sm:grid" />
          <Link
            href="/book-demo"
            className="btn-brand hidden rounded-lg px-4 py-2 text-[13px] font-semibold text-white sm:inline-block"
          >
            Book a demo
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="glass hover-glow grid h-9 w-9 place-items-center rounded-lg text-fg md:hidden"
          >
            {open ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 1L15 15M15 1L1 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 3H15M1 8H15M1 13H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="glass-strong animate-slide-down border-t border-white/10 px-5 pb-5 pt-2 md:hidden">
          <nav className="flex flex-col">
            {menu.map((item) => (
              <Link
                key={item.id}
                href={item.url}
                onClick={() => setOpen(false)}
                className={`border-b border-white/5 py-3 text-[14px] font-medium transition-colors duration-200 ease-out ${isActive(pathname, item.url) ? "text-fg" : "text-haze hover:text-fg"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex items-center gap-3">
            <Link
              href="/book-demo"
              onClick={() => setOpen(false)}
              className="btn-brand block flex-1 rounded-lg px-4 py-2.5 text-center text-[13px] font-semibold text-white"
            >
              Book a demo
            </Link>
            <ThemeToggle className="sm:hidden" />
          </div>
        </div>
      )}
    </header>
  );
}
