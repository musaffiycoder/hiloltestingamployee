import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Clock3, ListChecks, Shuffle } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, Ico, Pill, SectionTitle } from "@/components/ui";
import { getPositionPlan } from "@/lib/test-config";

export const metadata: Metadata = { title: "Test konstruktori" };

export default async function BuilderIndex() {
  await requireUser();
  const positions = await db.position.findMany({ orderBy: { title: "asc" }, select: { id: true, code: true, title: true } });
  const plans = await Promise.all(positions.map((p) => getPositionPlan(p.id)));

  return (
    <div className="flex flex-col gap-7">
      <header className="px-1">
        <h2 className="text-[34px] font-bold leading-tight">Test konstruktori</h2>
        <p className="mt-1 max-w-2xl text-[15px] text-tx2">
          Har lavozim testining tarkibi: nechta savol, qaysi kompetensiyadan qancha, umumiy vaqt va savollar tartibi. Savollar har
          nomzodga bankdan tasodifiy, darajalar muvozanati saqlangan holda tanlanadi.
        </p>
      </header>

      <section>
        <SectionTitle>Lavozimlar</SectionTitle>
        <Card>
          <ul>
            {positions.map((p, i) => {
              const plan = plans[i];
              const bank = plan.competencies.reduce((s, c) => s + c.available, 0);
              return (
                <li key={p.id} className={i < positions.length - 1 ? "border-b border-line" : ""}>
                  <Link href={`/hr/konstruktor/${p.code}`} className="flex items-center gap-3 px-4 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-semibold">{p.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-tx2">
                        <span>
                          <Ico icon={ListChecks} size={13} className="mr-1" />
                          {plan.total} / {bank} savol
                        </span>
                        <span>
                          <Ico icon={Clock3} size={13} className="mr-1" />~{plan.timeLimitMin ?? plan.estimatedMin} daqiqa
                        </span>
                        {plan.order === "mixed" && (
                          <span>
                            <Ico icon={Shuffle} size={13} className="mr-1" />
                            aralash tartib
                          </span>
                        )}
                      </span>
                    </span>
                    {plan.configured ? <Pill tone="brand">Sozlangan</Pill> : <Pill>Standart</Pill>}
                    <ChevronRight size={18} aria-hidden className="shrink-0 text-tx2" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
        <p className="mt-2 px-4 text-[13px] text-tx2">«Standart» — bankdagi barcha faol savollar, kompetensiyalar tartibida.</p>
      </section>
    </div>
  );
}
