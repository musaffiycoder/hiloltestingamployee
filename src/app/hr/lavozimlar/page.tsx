import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, LevelChip, Pill } from "@/components/ui";

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
    <div className="flex flex-col gap-6">
      <header>
        
        <p className="mt-1 text-sm text-tx2">
          Har bir lavozim uchun talab darajasi, vazn va savollar qamrovi. † — yo'riqnomadan olingan, tasdiqlash kutilmoqda.
        </p>
      </header>

      {positions.map((p) => (
        <Card key={p.id} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
            <h2 className="text-lg font-bold">{p.title}</h2>
            <Pill tone="soft">{p.competencies.reduce((s, c) => s + c.questions.length, 0)} savol</Pill>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-tx2">
                <tr>
                  <th className="px-4 py-2">Kod</th>
                  <th className="px-4 py-2">Kompetensiya</th>
                  <th className="px-4 py-2">Talab</th>
                  <th className="px-4 py-2">Vazn</th>
                  <th className="px-4 py-2">Savollar (1–5)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {p.competencies.map((c) => {
                  const counts = [1, 2, 3, 4, 5].map((l) => c.questions.filter((q) => q.level === l).length);
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-2.5 font-mono text-xs text-tx2">{c.code}</td>
                      <td className="px-4 py-2.5 font-semibold">
                        {c.name}
                        {c.derived && <span title="Yo'riqnomadan olingan, tasdiqlash kerak" className="ml-1 text-brd">†</span>}
                        {c.critical && <span title="Kritik kompetensiya" className="ml-2 text-xs text-bad">⛨ kritik</span>}
                      </td>
                      <td className="px-4 py-2.5"><LevelChip level={c.target} /></td>
                      <td className="px-4 py-2.5 font-bold">{c.weight}%</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          {counts.map((n, i) => (
                            <span
                              key={i}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                                n === 0 ? "border border-dashed border-line text-tx2" : "bg-soft"
                              } ${i + 1 === c.target ? "ring-2 ring-br" : ""}`}
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
      <p className="text-xs text-tx2">Punktir katak «0» — savol yo'q. Halqa — talab darajasi.</p>
    </div>
  );
}
