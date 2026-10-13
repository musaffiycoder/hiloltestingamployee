import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Pill } from "@/components/ui";
import { QuestionForm, type FormInitial } from "../question-form";

export const metadata: Metadata = { title: "Savolni tahrirlash" };

type RawOpt = string | { text: string; points?: number; flag?: boolean };

export default async function EditQuestionPage({ params }: PageProps<"/hr/savollar/[id]">) {
  await requireUser();
  const { id } = await params;
  const [q, positions] = await Promise.all([
    db.question.findUnique({
      where: { id },
      include: { competency: { include: { position: { select: { code: true } } } }, _count: { select: { responses: true } } },
    }),
    db.position.findMany({
      orderBy: { title: "asc" },
      select: { code: true, title: true, competencies: { orderBy: { sortOrder: "asc" }, select: { code: true, name: true } } },
    }),
  ]);
  if (!q) notFound();

  const raw = ((q.payload as { options?: RawOpt[] })?.options ?? []) as RawOpt[];
  const key = (q.answerKey as { correct?: number | number[] } | null)?.correct;
  const correct = new Set(Array.isArray(key) ? key : typeof key === "number" ? [key] : []);
  const options = raw.map((o, i) => ({
    text: typeof o === "string" ? o : o.text,
    correct: correct.has(i),
    points: typeof o === "string" ? 3 : (o.points ?? 3),
    flag: typeof o === "string" ? false : !!o.flag,
  }));
  const rubric = ((q.rubric as { points?: string[] } | null)?.points ?? []).length
    ? (q.rubric as { points: string[] }).points
    : ["", ""];

  const initial: FormInitial = {
    id: q.id,
    position: q.competency.position.code,
    competency: q.competency.code,
    level: q.level,
    type: (["MCQ_SINGLE", "MCQ_MULTI", "SITUATIONAL", "OPEN"].includes(q.type) ? q.type : "MCQ_SINGLE") as FormInitial["type"],
    stem: q.stem,
    options: options.length ? options : [0, 1, 2, 3].map(() => ({ text: "", correct: false, points: 3, flag: false })),
    rubric,
    explanation: q.explanation ?? "",
    timeLimitSec: q.timeLimitSec,
    status: q.status,
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/hr/savollar" className="inline-flex items-center gap-1 text-[17px] text-brd">
        <span aria-hidden className="text-2xl leading-none">‹</span> Savollar banki
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[28px] font-bold leading-tight">Savolni tahrirlash</h2>
        <Pill tone={q.status === "ACTIVE" ? "ok" : q.status === "DRAFT" ? "warn" : "soft"}>
          {q.status === "ACTIVE" ? "Faol" : q.status === "DRAFT" ? "Qoralama" : "Arxiv"}
        </Pill>
        <Pill>v{q.version}</Pill>
      </div>
      {q._count.responses > 0 && (
        <p className="rounded-2xl bg-warn-t p-3 text-[15px] text-warn">
          Bu savolga {q._count.responses} ta javob berilgan. O'zgartirsangiz, yangi versiya yaratiladi va eskisi arxivlanadi
          (avvalgi natijalar o'zgarmaydi).
        </p>
      )}
      <QuestionForm positions={positions} initial={initial} />
    </div>
  );
}
