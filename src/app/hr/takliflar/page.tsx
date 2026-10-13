import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, Pill, SectionTitle } from "@/components/ui";
import { InviteForm } from "./form";

export const metadata: Metadata = { title: "Takliflar" };

const STATUS: Record<string, { label: string; tone: "soft" | "brand" | "ok" | "warn" | "bad" }> = {
  INVITED: { label: "Yuborildi", tone: "soft" },
  STARTED: { label: "Jarayonda", tone: "brand" },
  SUBMITTED: { label: "Topshirdi", tone: "ok" },
  EXPIRED: { label: "Muddati o'tdi", tone: "bad" },
};

export default async function InvitesPage() {
  await requireUser();
  const [positions, invites] = await Promise.all([
    db.position.findMany({
      orderBy: { title: "asc" },
      include: { competencies: { select: { _count: { select: { questions: true } } } } },
    }),
    db.assessment.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { position: true } }),
  ]);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="flex flex-col gap-6">
      <header>
        
        <p className="mt-1 text-sm text-tx2">Nomzod yoki xodimga shaxsiy havola yuboring.</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-2">
          <SectionTitle>Yangi taklif</SectionTitle>
          <Card className="p-5">
            <InviteForm
              positions={positions.map((p) => ({
                id: p.id,
                title: p.title,
                questions: p.competencies.reduce((s, c) => s + c._count.questions, 0),
              }))}
            />
          </Card>
        </section>
        <section className="lg:col-span-3">
          <SectionTitle>So'nggi takliflar</SectionTitle>
          <Card className="divide-y divide-line">
            {invites.length === 0 && <p className="p-5 text-sm text-tx2">Hozircha bo'sh.</p>}
            {invites.map((i) => {
              const s = STATUS[i.status];
              return (
                <div key={i.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{i.subjectName}</div>
                    <div className="truncate text-xs text-tx2">
                      {i.position.title} · {i.mode === "RECRUITING" ? "Recruiting" : "Baholash"}
                    </div>
                    <code className="mt-1 block truncate font-mono text-[11px] text-tx2">{base}/t/{i.token}</code>
                  </div>
                  <Pill tone={s.tone}>{s.label}</Pill>
                </div>
              );
            })}
          </Card>
        </section>
      </div>
    </div>
  );
}
