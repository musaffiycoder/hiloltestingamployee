import type { Metadata } from "next";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, Pill, SectionTitle } from "@/components/ui";
import { InviteForm } from "./form";
import { InviteActions } from "./invite-actions";

export const metadata: Metadata = { title: "Takliflar" };

const STATUS: Record<string, { label: string; tone: "soft" | "brand" | "ok" | "warn" | "bad" }> = {
  INVITED: { label: "Yuborildi", tone: "soft" },
  STARTED: { label: "Jarayonda", tone: "brand" },
  SUBMITTED: { label: "Topshirdi", tone: "ok" },
  EXPIRED: { label: "Muddati o'tdi", tone: "bad" },
};

export default async function InvitesPage() {
  const viewer = await requireUser();
  const canWrite = viewer.role !== "MANAGER";
  const [positions, invites] = await Promise.all([
    db.position.findMany({
      orderBy: { title: "asc" },
      include: { competencies: { select: { _count: { select: { questions: { where: { status: "ACTIVE" } } } } } } },
    }),
    db.assessment.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { position: true } }),
  ]);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const base = host ? `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}` : "";

  return (
    <div className="flex flex-col gap-6">
      <header>
        
        <p className="mt-1 text-sm text-tx2">Nomzod yoki xodimga shaxsiy havola yuboring.</p>
      </header>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-5">
        {canWrite && <section className="lg:col-span-2">
          <SectionTitle>Yangi taklif</SectionTitle>
          <div>
            <InviteForm
              positions={positions.map((p) => ({
                id: p.id,
                title: p.title,
                questions: p.competencies.reduce((s, c) => s + c._count.questions, 0),
              }))}
            />
          </div>
        </section>}
        <section className={canWrite ? "lg:col-span-3" : "lg:col-span-5"}>
          <SectionTitle>So'nggi takliflar</SectionTitle>
          <Card>
            {invites.length === 0 && <p className="px-4 py-3.5 text-[15px] text-tx2">Hozircha bo'sh.</p>}
            <ul>
              {invites.map((i, idx) => {
                const s = STATUS[i.status];
                return (
                  <li key={i.id} className={`flex items-center gap-3 px-4 py-3 ${idx < invites.length - 1 ? "border-b border-line" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[17px] font-semibold">{i.subjectName}</div>
                      <div className="truncate text-[13px] text-tx2">
                        {i.position.title} · {i.mode === "RECRUITING" ? "Recruiting" : "Baholash"}
                      </div>
                      <code className="mt-0.5 block truncate font-mono text-[11px] text-tx2">{base}/t/{i.token}</code>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Pill tone={s.tone}>{s.label}</Pill>
                      {canWrite && <InviteActions id={i.id} link={`${base}/t/${i.token}`} status={i.status} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      </div>
    </div>
  );
}
