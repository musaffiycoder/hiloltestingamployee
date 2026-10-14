import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAssessmentByToken } from "@/lib/attempt-access";
import { db } from "@/lib/db";
import { seededShuffle } from "@/lib/shuffle";
import { Runner, type RunnerQuestion } from "./runner";

// Yakunlash bosilganda fon rejimida AI baholash va tahlil ishlaydi (after()).
export const maxDuration = 300;

export const metadata: Metadata = { title: "Test", robots: { index: false, follow: false } };

export default async function TestPage({ params }: PageProps<"/t/[token]/test">) {
  const { token } = await params;
  const a = await getAssessmentByToken(token);
  if (!a) redirect(`/t/${token}`);
  const attempt = a.attempts[0];
  if (a.status === "SUBMITTED" || attempt?.finishedAt) redirect(`/t/${token}/done`);
  if (!attempt) redirect(`/t/${token}`);

  const ids = attempt.questionIds as string[];
  const [questions, responses] = await Promise.all([
    db.question.findMany({ where: { id: { in: ids } }, include: { competency: { select: { name: true } } } }),
    db.response.findMany({ where: { attemptId: attempt.id } }),
  ]);
  const order = new Map(ids.map((id, i) => [id, i]));
  questions.sort((x, y) => order.get(x.id)! - order.get(y.id)!);
  const saved = new Map(responses.map((r) => [r.questionId, r.payload as { selected?: number | number[] | null; text?: string }]));

  // Javob kalitlari va ballar mijozga yuborilmaydi.
  // Variantlar har bir urinish uchun deterministik aralashtiriladi; `idx` — asl indeks.
  const payload: RunnerQuestion[] = questions.map((q) => {
    const texts = ((q.payload as { options?: (string | { text: string })[] })?.options ?? []).map((o) =>
      typeof o === "string" ? o : o.text,
    );
    const opts = seededShuffle(
      texts.map((text, idx) => ({ text, idx })),
      `${attempt.id}:${q.id}`,
    );
    const key = (q.answerKey as { correct?: number | number[] } | null)?.correct;
    return {
      id: q.id,
      type: q.type as RunnerQuestion["type"],
      stem: q.stem,
      options: opts,
      multi: q.type === "MCQ_MULTI" || Array.isArray(key),
      section: q.competency.name,
      timeLimitSec: q.timeLimitSec,
      saved: saved.get(q.id) ?? null,
    };
  });

  const totalSec = attempt.timeLimitSec ?? payload.reduce((s, q) => s + q.timeLimitSec, 0);
  const elapsed = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);

  return (
    <Runner
      token={token}
      positionTitle={a.position.title}
      questions={payload}
      remainingSec={Math.max(30, totalSec - elapsed)}
    />
  );
}
