import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { QuestionForm } from "../question-form";

export const metadata: Metadata = { title: "Yangi savol" };

export default async function NewQuestionPage({ searchParams }: PageProps<"/hr/savollar/yangi">) {
  await requireUser();
  const sp = await searchParams;
  const positions = await db.position.findMany({
    orderBy: { title: "asc" },
    select: { code: true, title: true, competencies: { orderBy: { sortOrder: "asc" }, select: { code: true, name: true } } },
  });
  const pos = positions.find((p) => p.code === sp.p) ?? positions[0];
  return (
    <div className="flex flex-col gap-5">
      <Link href="/hr/savollar" className="inline-flex items-center gap-1 text-[17px] text-brd">
        <span aria-hidden className="text-2xl leading-none">‹</span> Savollar banki
      </Link>
      <h2 className="text-[28px] font-bold leading-tight">Yangi savol</h2>
      <QuestionForm
        positions={positions}
        initial={{
          position: pos.code,
          competency: pos.competencies[0]?.code ?? "",
          level: 3,
          type: "MCQ_SINGLE",
          stem: "",
          options: [0, 1, 2, 3].map(() => ({ text: "", correct: false, points: 3, flag: false })),
          rubric: ["", ""],
          explanation: "",
          timeLimitSec: 90,
          status: "DRAFT",
        }}
      />
    </div>
  );
}
