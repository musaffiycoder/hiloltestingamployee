import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, LevelChip, SectionTitle, Ico } from "@/components/ui";
import { ShieldAlert } from "lucide-react";

export const metadata: Metadata = { title: "Lavozim kartalari" };

export default async function PositionsPage() {
  await requireUser();
  const positions = await db.position.findMany({
    orderBy: { title: "asc" },
    include: {
      competencies: {
        orderBy: { sortOrder: "asc" },
        include: { questions: { select: { level: true } } },
      },
    },
  });

  return (
    <div className="flex flex-col gap-7">
      <header className="px-1">
        <h2 className="text-[34px] font-bold leading-tight">Lavozim kartalari</h2>
        <p className="mt-1 text-[15px] text-tx2">
          Talab darajasi, vazn va savollar qamrovi. <span className="text-brd">†</span> — yo'riqnomadan olingan, tasdiqlash
          kutilmoqda.
        </p>
      </header>

      {positions.map((p) => {
        const total = p.competencies.reduce((s, c) => s + c.questions.length, 0);
        return (
          <section key={p.id}>
            <SectionTitle aside={<span className="text-[13px] text-tx2">{total} savol</span>}>{p.title}</SectionTitle>
            <Card>
              <ul>
                {p.competencies.map((c, i) => {
                  const counts = [1, 2, 3, 4, 5].map((l) => c.questions.filter((q) => q.level === l).length);
                  return (
                    <li
                      key={c.id}
                      className={`px-4 py-3 ${i < p.competencies.length - 1 ? "border-b border-line" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 w-7 shrink-0 font-mono text-xs text-tx2">{c.code}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[15px] font-medium leading-snug">
                            {c.name}
                            {c.derived && (
                              <span title="Yo'riqnomadan olingan, tasdiqlash kerak" className="ml-1 text-brd">
                                †
                              </span>
                            )}
                            {c.critical && (
                              <span title="Kritik kompetensiya" className="ml-2 text-xs font-semibold text-bad">
                                <Ico icon={ShieldAlert} size={12} className="mr-0.5" />
                                kritik
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-1" aria-label="Savollar soni daraja bo'yicha (1–5)">
                            {counts.map((n, k) => (
                              <span
                                key={k}
                                className={`flex h-6 w-7 items-center justify-center rounded-md text-xs font-semibold tabular-nums ${
                                  n === 0 ? "border border-dashed border-line text-tx2" : "bg-soft"
                                } ${k + 1 === c.target ? "ring-2 ring-br" : ""}`}
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <LevelChip level={c.target} />
                          <span className="text-[13px] font-semibold tabular-nums text-tx2">{c.weight}%</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        );
      })}
      <p className="px-4 text-[13px] text-tx2">Punktir katak «0» — savol yo'q. Halqa — talab darajasi.</p>
    </div>
  );
}
