import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAssessmentByToken } from "@/lib/attempt-access";

export const metadata: Metadata = { title: "Rahmat", robots: { index: false, follow: false } };

export default async function DonePage({ params }: PageProps<"/t/[token]/done">) {
  const { token } = await params;
  const a = await getAssessmentByToken(token);
  if (!a) notFound();
  const candidate = a.mode === "RECRUITING";
  return (
    <main className="mesh-bg flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-md rounded-[24px] p-8 text-center shadow-soft">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ok-t text-2xl text-ok" aria-hidden>
          ✓
        </div>
        <h1 className="font-display text-3xl font-bold">Rahmat, {a.subjectName.split(" ")[0]}!</h1>
        <p className="mt-3 text-[15px] text-tx2">
          {a.status === "SUBMITTED"
            ? candidate
              ? "Javoblaringiz HR ga yuborildi. Tez orada siz bilan bog'lanamiz."
              : "Javoblaringiz qabul qilindi. Natija va rivojlanish rejasi bilan HR sizni tanishtiradi."
            : "Test hali yakunlanmagan. Havola orqali davom etishingiz mumkin."}
        </p>
      </div>
    </main>
  );
}
