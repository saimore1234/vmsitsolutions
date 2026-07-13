import type { Metadata } from "next";
import { ContactSection } from "@/components/site/contact";
import { getSiteSettings, companyOrDefault } from "@/lib/site-settings";

export const revalidate = 60;
export const metadata: Metadata = { title: "Book a Demo" };

export default async function BookDemoPage() {
  const settings = await getSiteSettings();
  const company = companyOrDefault(settings.company);

  return (
    <div className="pt-16">
      <ContactSection email={company.email} phone={company.phone} mobile={company.mobile} supportEmail={company.supportEmail} defaultKind="demo" communication={settings.communication} />
    </div>
  );
}
