import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { Reveal } from "@/components/site/Reveal";
import { publicGet } from "@/lib/api";

interface Career {
  id: string; title: string; department: string | null; location: string | null;
  jobType: string; experience: string | null;
}

const JOB_TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time", part_time: "Part-time", contract: "Contract", remote: "Remote",
};

export const revalidate = 60;
export const metadata: Metadata = { title: "Careers" };

export default async function CareersPage() {
  const { items } = await publicGet<{ items: Career[] }>("/careers?limit=50", { items: [] });

  return (
    <>
      <PageHero eyebrow="Careers" title="Build ERP that manufacturers actually use" subtitle="Open roles across implementation, engineering and customer success." />
      <section className="relative py-14">
        <div className="relative mx-auto max-w-4xl px-5">
          <div className="glass divide-y divide-white/10 rounded-xl">
            {items.map((c, i) => (
              <Reveal key={c.id} delayMs={Math.min(i, 5) * 60}>
                <Link href={`/careers/${c.id}`} className="group flex items-center justify-between gap-4 p-6 transition-colors duration-200 ease-out hover:bg-white/4">
                  <div>
                    <h2 className="font-display text-base font-semibold text-fg transition-colors group-hover:text-gradient">{c.title}</h2>
                    <p className="mt-1 text-sm text-haze">
                      {[c.department, c.location, JOB_TYPE_LABEL[c.jobType] ?? c.jobType, c.experience].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-aqua transition-transform duration-200 ease-out group-hover:translate-x-1">Apply →</span>
                </Link>
              </Reveal>
            ))}
            {!items.length && <p className="p-6 text-sm text-haze">No open roles right now — check back soon.</p>}
          </div>
        </div>
      </section>
    </>
  );
}
