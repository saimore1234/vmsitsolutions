"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { pickLogo, type Company, type MenuItem, type SiteLogo, type LogoSettings } from "./sections";

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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          {desktopLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mobileLogo?.url ?? desktopLogo.url} alt={company.companyName ?? "Logo"} style={{ height: mobileHeight, width: "auto" }} className="object-contain sm:hidden" />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-cobalt font-display text-sm font-bold text-white sm:hidden">
              {(company.shortName ?? "V").slice(0, 1)}
            </span>
          )}
          {desktopLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={desktopLogo.url} alt={company.companyName ?? "Logo"} style={{ height: headerHeight, width: "auto" }} className="hidden object-contain sm:block" />
          ) : (
            <span className="hidden h-8 w-8 place-items-center rounded-lg bg-cobalt font-display text-sm font-bold text-white sm:grid">
              {(company.shortName ?? "V").slice(0, 1)}
            </span>
          )}
          <span className="font-display text-[15px] font-semibold tracking-tight text-white">
            {company.companyName ?? "VMS IT Solutions"}
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {menu.map((item) => (
            <Link
              key={item.id}
              href={item.url}
              className={`text-[13px] font-medium transition-colors duration-200 ease-out ${isActive(pathname, item.url) ? "text-white" : "text-slate-x hover:text-white"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/book-demo"
            className="hidden rounded-lg bg-cobalt px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-cobalt-soft hover:shadow-lg hover:shadow-cobalt/20 active:translate-y-0 active:scale-95 sm:inline-block"
          >
            Book a demo
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-white transition-colors duration-200 ease-out hover:border-white/40 md:hidden"
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
        <div className="animate-slide-down border-t border-white/10 bg-ink px-5 pb-5 pt-2 md:hidden">
          <nav className="flex flex-col">
            {menu.map((item) => (
              <Link
                key={item.id}
                href={item.url}
                onClick={() => setOpen(false)}
                className={`border-b border-white/5 py-3 text-[14px] font-medium transition-colors duration-200 ease-out ${isActive(pathname, item.url) ? "text-white" : "text-slate-x hover:text-white"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/book-demo"
            onClick={() => setOpen(false)}
            className="mt-4 block rounded-lg bg-cobalt px-4 py-2.5 text-center text-[13px] font-semibold text-white transition-all duration-200 ease-out hover:bg-cobalt-soft active:scale-95"
          >
            Book a demo
          </Link>
        </div>
      )}
    </header>
  );
}
