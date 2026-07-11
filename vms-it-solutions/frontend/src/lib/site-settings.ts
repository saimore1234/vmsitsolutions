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
  return publicGet<PublicSettings>("/settings/public", { company: null, logos: [], logoSetting: null, communication: null, menus: { header: [], footer: [] } });
}

export function companyOrDefault(company: Company | null): Company {
  return company ?? { companyName: "VMS IT Solutions", shortName: "VMS" };
}
