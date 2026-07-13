import type { Metadata } from "next";
import { ContactSection } from "@/components/site/contact";
import { getSiteSettings, companyOrDefault } from "@/lib/site-settings";

export const revalidate = 60;
export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const settings = await getSiteSettings();
  const company = companyOrDefault(settings.company);

  return (
    <div className="pt-16">
      <ContactSection
        email={company.email}
        phone={company.phone}
        mobile={company.mobile}
        supportEmail={company.supportEmail}
        eyebrow="Contact us"
        title="Talk to a person, not a ticket queue"
        description="Questions about pricing, timelines or fit for your business — send us a note and we'll reply within one business day."
        defaultKind="contact"
        communication={settings.communication}
      />
    </div>
  );
}
