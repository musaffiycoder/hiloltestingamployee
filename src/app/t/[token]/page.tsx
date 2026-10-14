import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAssessmentByToken, isExpired } from "@/lib/attempt-access";
import { getPositionPlan } from "@/lib/test-config";
import { startAttempt } from "./actions";
import { Check } from "lucide-react";

export const metadata: Metadata = { title: "Baholash testi", robots: { index: false, follow: false } };

export default async function InvitePage({ params, searchParams }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const a = await getAssessmentByToken(token);
  if (!a) notFound();
  if (a.status === "SUBMITTED") redirect(`/t/${token}/done`);

  const expired = isExpired(a);
  // Konstruktor sozlamasi bo'yicha: savollar soni, bo'limlar va taxminiy vaqt
  const plan = await getPositionPlan(a.positionId);
  const questionCount = plan.total;
  const sections = plan.competencies.filter((c) => c.count > 0).length;
  const minutes = Math.max(5, plan.timeLimitMin ?? plan.estimatedMin);
  const resuming = a.status === "STARTED";

  const infoRows: [string, string][] = [
    ["Davomiyligi", `~${minutes} daqiqa`],
    ["Savollar", String(questionCount)],
    ["Bo'limlar", String(sections)],
  ];

  return (
    <main className="mesh-bg min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 px-1">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[12px] bg-gradient-to-b from-[#ff8a3d] to-[#e5530a] text-2xl font-bold text-white">
            B
          </div>
          <h1 className="text-[34px] font-bold leading-tight">Salom, {a.subjectName.split(" ")[0]}!</h1>
          <p className="mt-2 text-[17px] text-tx2">
            <b className="font-semibold text-tx">{a.position.title}</b> uchun baholash testiga taklif qilindingiz.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-card">
          {infoRows.map(([k, v], i) => (
            <div key={k} className={`flex items-center justify-between px-4 py-3.5 text-[17px] ${i < infoRows.length - 1 ? "border-b border-line" : ""}`}>
              <span>{k}</span>
              <span className="text-tx2 tabular-nums">{v}</span>
            </div>
          ))}
        </div>

        {expired ? (
          <p role="alert" className="mt-4 rounded-2xl bg-bad-t p-4 text-[15px] font-medium text-bad">
            Taklif muddati tugagan. HR bilan bog'laning.
          </p>
        ) : questionCount === 0 ? (
          <p className="mt-4 rounded-2xl bg-warn-t p-4 text-[15px] font-medium text-warn">
            Bu test hali tayyor emas. Iltimos, keyinroq urinib ko'ring.
          </p>
        ) : (
          <form action={startAttempt.bind(null, token)} className="mt-6 flex flex-col gap-5">
            <div>
              <h2 className="mb-2 px-4 text-[13px] font-semibold uppercase tracking-wide text-tx2">Qoidalar</h2>
              <ul className="overflow-hidden rounded-2xl bg-card text-[15px]">
                {[
                  "Savollarga o'zingiz javob bering. Bu sizning bilim va ko'nikmangizni o'lchaydi.",
                  "To'g'ri javoblar va ballar test davomida ko'rsatilmaydi.",
                  "Brauzer oynasidan chiqsangiz, bu qayd etiladi. Test to'xtamaydi.",
                  "Javoblar avtomatik saqlanadi; uzilsa, havola orqali davom etasiz.",
                ].map((t, i, arr) => (
                  <li key={t} className="relative flex gap-3 px-4 py-3">
                    <Check size={18} strokeWidth={2.6} className="mt-0.5 shrink-0 text-ok" aria-hidden />
                    <span>{t}</span>
                    {i < arr.length - 1 && <span className="absolute bottom-0 left-11 right-0 h-px bg-line" aria-hidden />}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="flex items-center gap-4 rounded-2xl bg-card px-4 py-3.5 text-[15px]">
                <span className="flex-1">
                  Shaxsiy ma'lumotlarim (ism, javoblar, natijalar) baholash maqsadida qayta ishlanishiga, ochiq javoblarim
                  sun'iy intellekt (Anthropic Claude) yordamida tahlil qilinishiga (yakuniy qaror odam tomonidan
                  qabul qilinadi) va test davomida oyna fokusi kuzatilishiga roziman.
                </span>
                <input type="checkbox" name="consent" required className="ios-switch" />
              </label>
              {sp.consent === "required" && (
                <p role="alert" className="mt-2 px-4 text-[13px] font-medium text-bad">Davom etish uchun rozilik kerak.</p>
              )}
            </div>

            <button className="h-[50px] rounded-full bg-brf text-[17px] font-semibold text-onbr">
              {resuming ? "Davom etish" : "Boshlash"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
