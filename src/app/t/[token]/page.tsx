import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAssessmentByToken, isExpired } from "@/lib/attempt-access";
import { db } from "@/lib/db";
import { SUPPORTED_TYPES } from "@/lib/labels";
import { startAttempt } from "./actions";

export const metadata: Metadata = { title: "Baholash testi", robots: { index: false, follow: false } };

export default async function InvitePage({ params, searchParams }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const a = await getAssessmentByToken(token);
  if (!a) notFound();
  if (a.status === "SUBMITTED") redirect(`/t/${token}/done`);

  const expired = isExpired(a);
  const [questionCount, sections] = await Promise.all([
    db.question.count({
      where: { status: "ACTIVE", type: { in: [...SUPPORTED_TYPES] }, competency: { positionId: a.positionId } },
    }),
    db.competency.count({ where: { positionId: a.positionId, questions: { some: { status: "ACTIVE" } } } }),
  ]);
  const minutes = Math.max(
    5,
    Math.round(
      ((
        await db.question.aggregate({
          where: { status: "ACTIVE", type: { in: [...SUPPORTED_TYPES] }, competency: { positionId: a.positionId } },
          _sum: { timeLimitSec: true },
        })
      )._sum.timeLimitSec ?? 0) / 60,
    ),
  );
  const resuming = a.status === "STARTED";

  return (
    <main className="mesh-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-xl rounded-[24px] p-6 shadow-soft sm:p-8">
        <div className="font-display text-xl font-bold text-navy">Baholash</div>
        <h1 className="mt-5 font-display text-3xl font-bold leading-tight">Salom, {a.subjectName.split(" ")[0]}!</h1>
        <p className="mt-2 text-[15px] text-tx2">
          <b className="text-tx">{a.position.title}</b> uchun baholash testiga taklif qilindingiz.
        </p>

        <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            [`~${minutes}`, "daqiqa"],
            [String(questionCount), "savol"],
            [String(sections), "bo'lim"],
          ].map(([n, l]) => (
            <div key={l} className="rounded-2xl bg-card p-3">
              <dt className="sr-only">{l}</dt>
              <dd className="font-display text-3xl font-bold text-navy">{n}</dd>
              <div className="text-xs font-bold uppercase tracking-wide text-tx2">{l}</div>
            </div>
          ))}
        </dl>

        {expired ? (
          <p role="alert" className="mt-6 rounded-xl bg-bad-t p-3 text-sm font-semibold text-bad">
            Taklif muddati tugagan. HR bilan bog'laning.
          </p>
        ) : questionCount === 0 ? (
          <p className="mt-6 rounded-xl bg-warn-t p-3 text-sm font-semibold text-warn">
            Bu test hali tayyor emas. Iltimos, keyinroq urinib ko'ring.
          </p>
        ) : (
          <form action={startAttempt.bind(null, token)} className="mt-6 flex flex-col gap-5">
            <ul className="flex flex-col gap-2 text-sm">
              {[
                "Savollarga o'zingiz javob bering. Bu sizning bilim va ko'nikmangizni o'lchaydi.",
                "To'g'ri javoblar va ballar test davomida ko'rsatilmaydi.",
                "Brauzer oynasidan chiqsangiz, bu qayd etiladi. Test to'xtamaydi.",
                "Javoblar avtomatik saqlanadi; uzilsa, havola orqali davom etasiz.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-0.5 text-ok" aria-hidden>✓</span>
                  {t}
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-3 rounded-2xl bg-card p-3 text-sm">
              <input type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 accent-[var(--br)]" />
              <span>
                Shaxsiy ma'lumotlarim (ism, javoblar, natijalar) baholash maqsadida qayta ishlanishiga va test davomida
                oyna fokusi kuzatilishiga roziman.
              </span>
            </label>
            {sp.consent === "required" && (
              <p role="alert" className="text-sm font-semibold text-bad">Davom etish uchun rozilik kerak.</p>
            )}
            <button className="h-13 min-h-12 rounded-full bg-br text-base font-bold text-[#1a0c02]">
              {resuming ? "Davom etish" : "Boshlash"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
