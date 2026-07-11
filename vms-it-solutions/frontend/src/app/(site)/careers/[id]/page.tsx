import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { API_URL } from "@/lib/api";
import { CareerApplyForm } from "@/components/site/CareerApplyForm";

interface Career {
  id: string; title: string; department: string | null; location: string | null;
  jobType: string; experience: string | null; salaryRange: string | null;
  description: string; requirements: string | null; status: string;
}

const JOB_TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time", part_time: "Part-time", contract: "Contract", remote: "Remote",
};

async function getCareer(id: string): Promise<Career | null> {
  try {
    const res = await fetch(`${API_URL}/careers/${id}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const career = await getCareer(id);
  return { title: career?.title ?? "Role not found" };
}

export default async function CareerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const career = await getCareer(id);
  if (!career || career.status !== "open") notFound();

  return (
    <div className="bg-paper pb-20 pt-32">
      <div className="mx-auto max-w-4xl px-5">
        <Link href="/careers" className="text-xs text-slate-500 hover:text-cobalt">← Back to careers</Link>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight text-ink">{career.title}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {[career.department, career.location, JOB_TYPE_LABEL[career.jobType] ?? career.jobType, career.experience, career.salaryRange].filter(Boolean).join(" · ")}
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <div>
              <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">About the role</h2>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{career.description}</p>
            </div>
            {career.requirements && (
              <div>
                <h2 className="font-mono-x text-[10px] uppercase tracking-widest text-slate-400">Requirements</h2>
                <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{career.requirements}</p>
              </div>
            )}
          </div>
          <div>
            <CareerApplyForm careerId={career.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
