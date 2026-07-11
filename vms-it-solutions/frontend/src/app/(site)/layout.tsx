import { Navbar } from "@/components/site/Navbar";
import { Footer, type MenuItem } from "@/components/site/sections";
import { PopupManager } from "@/components/site/PopupManager";
import { PageTransition } from "@/components/site/PageTransition";
import { getSiteSettings, companyOrDefault } from "@/lib/site-settings";

// Shared chrome for every public page — fetched once per request and reused by every
// route under this group so header/footer/logo data doesn't need to be re-wired per page.
export const revalidate = 60;

const FALLBACK_HEADER: MenuItem[] = [
  { id: "products", label: "Products", url: "/products" },
  { id: "services", label: "Services", url: "/services" },
  { id: "industries", label: "Industries", url: "/industries" },
  { id: "blog", label: "Blog", url: "/blog" },
  { id: "careers", label: "Careers", url: "/careers" },
  { id: "contact", label: "Contact", url: "/contact" },
];
const FALLBACK_FOOTER: MenuItem[] = [
  { id: "about", label: "About", url: "/about" },
  { id: "privacy", label: "Privacy Policy", url: "/privacy" },
  { id: "terms", label: "Terms of Service", url: "/terms" },
];

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  const company = companyOrDefault(settings.company);
  const headerMenu = settings.menus.header.length ? settings.menus.header : FALLBACK_HEADER;
  const footerMenu = settings.menus.footer.length ? settings.menus.footer : FALLBACK_FOOTER;

  return (
    <>
      <Navbar company={company} menu={headerMenu} logos={settings.logos} logoSettings={settings.logoSetting} />
      <main><PageTransition>{children}</PageTransition></main>
      <Footer company={company} menu={footerMenu} logos={settings.logos} logoSettings={settings.logoSetting} />
      <PopupManager />
    </>
  );
}
