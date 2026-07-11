import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { getSiteSettings, companyOrDefault } from "@/lib/site-settings";

export const revalidate = 60;
export const metadata: Metadata = { title: "Privacy Policy" };

export default async function PrivacyPage() {
  const settings = await getSiteSettings();
  const company = companyOrDefault(settings.company);
  const name = company.companyName ?? "VMS IT Solutions";

  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy Policy" />
      <section className="bg-paper py-20">
        <div className="prose mx-auto max-w-3xl space-y-6 px-5 text-[15px] leading-relaxed text-slate-700">
          <p>
            {name} (&quot;we&quot;, &quot;us&quot;) collects the information you submit through our contact, demo and
            career forms — name, email, phone and any message you provide — solely to respond to your enquiry.
          </p>
          <p>
            We do not sell your data to third parties. Information is retained only as long as needed to service
            your enquiry or as required by law, and is stored on infrastructure we control.
          </p>
          <p>
            You may request access to, correction of, or deletion of your data at any time by writing to us using
            the contact details on our <a href="/contact" className="text-cobalt hover:text-cobalt-soft">contact page</a>.
          </p>
          <p>
            This site uses only the cookies necessary for the site to function and, where enabled, anonymised
            analytics to understand aggregate traffic. No personal data is sold or shared with advertisers.
          </p>
          <p className="text-sm text-slate-400">Last updated {new Date().toLocaleDateString()}.</p>
        </div>
      </section>
    </>
  );
}
