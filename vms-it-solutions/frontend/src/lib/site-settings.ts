import { publicGet } from "@/lib/api";
import type { Company, MenuItem, SiteLogo, LogoSettings } from "@/components/site/sections";

export interface CommunicationSettings {
  whatsappNumber: string | null;
  whatsappDefaultMessage: string | null;
  whatsappEnabled: boolean;
  autoRedirectEnabled: boolean;
  thankYouPageEnabled: boolean;
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string | null;
}

export interface PublicSettings {
  company: Company | null;
  logos: SiteLogo[];
  logoSetting: LogoSettings | null;
  communication: CommunicationSettings | null;
  menus: { header: MenuItem[]; footer: MenuItem[] };
}

export function getSiteSettings() {
  // revalidate: 0 (no caching) — this feeds the shared nav/footer/company info on every page.
  // With a 60s ISR cache, a build-time fetch that failed once (e.g. backend not yet reachable
  // during the Docker image build) could get baked in as the permanently-served "fresh" version,
  // since nothing after ever forces a real re-fetch in a way that's easy to reason about here.
  return publicGet<PublicSettings>("/settings/public", { company: null, logos: [], logoSetting: null, communication: null, menus: { header: [], footer: [] } }, 0);
}

export function companyOrDefault(company: Company | null): Company {
  return company ?? { companyName: "VMS IT Solutions", shortName: "VMS" };
}
