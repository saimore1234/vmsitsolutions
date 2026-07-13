import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { getSiteSettings, companyOrDefault } from "@/lib/site-settings";

export const revalidate = 60;
export const metadata: Metadata = { title: "Terms of Service" };

export default async function TermsPage() {
  const settings = await getSiteSettings();
  const company = companyOrDefault(settings.company);
  const name = company.companyName ?? "VMS IT Solutions";

  return (
    <>
      <PageHero eyebrow="Legal" title="Terms of Service" />
      <section className="relative py-14">
        <div className="glass prose prose-invert relative mx-auto max-w-3xl space-y-6 rounded-xl p-8 text-[15px] leading-relaxed text-mist">
          <p>
            By using this website or engaging {name} for implementation, customisation or support services, you
            agree to the terms outlined here and in the statement of work signed for your specific engagement.
          </p>
          <p>
            Content on this site — including product descriptions, pricing indications and case studies — is
            provided for general information and does not constitute a binding offer until confirmed in writing.
          </p>
          <p>
            Project scope, timelines and fees for any engagement are governed by the signed statement of work, not
            by marketing content on this site.
          </p>
          <p>
            We are not liable for indirect or consequential loss arising from use of this website. For engagement-
            specific liability terms, refer to your signed contract.
          </p>
          <p className="text-sm text-haze">Last updated {new Date().toLocaleDateString()}.</p>
        </div>
      </section>
    </>
  );
}
