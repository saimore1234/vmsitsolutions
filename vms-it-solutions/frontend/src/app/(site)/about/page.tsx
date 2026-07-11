import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { getSiteSettings, companyOrDefault } from "@/lib/site-settings";

export const revalidate = 60;
export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const settings = await getSiteSettings();
  const company = companyOrDefault(settings.company);
  const c = company as typeof company & {
    mission?: string | null; vision?: string | null; description?: string | null; aboutCompany?: string | null; ceoMessage?: string | null;
  };

  const blocks = [
    ["Who we are", c.aboutCompany ?? c.description],
    ["Our mission", c.mission],
    ["Our vision", c.vision],
    ["From our leadership", c.ceoMessage],
  ] as const;
  const hasContent = blocks.some(([, v]) => v);

  return (
    <>
      <PageHero eyebrow="About" title={`About ${company.companyName ?? "us"}`} subtitle={company.tagline ?? undefined} />
      <section className="bg-paper py-20">
        <div className="mx-auto max-w-3xl space-y-10 px-5">
          {hasContent ? blocks.filter(([, v]) => v).map(([heading, body]) => (
            <div key={heading}>
              <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">{heading}</h2>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{body}</p>
            </div>
          )) : (
            <p className="text-sm text-slate-400">Company details haven&apos;t been added in the admin panel yet.</p>
          )}
        </div>
      </section>
    </>
  );
}
