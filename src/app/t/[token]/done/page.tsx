import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAssessmentByToken } from "@/lib/attempt-access";
import { Check } from "lucide-react";

export const metadata: Metadata = { title: "Rahmat", robots: { index: false, follow: false } };

export default async function DonePage({ params }: PageProps<"/t/[token]/done">) {
  const { token } = await params;
  const a = await getAssessmentByToken(token);
  if (!a) notFound();
  const candidate = a.mode === "RECRUITING";
  return (
    <main className="mesh-bg flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-ok-t text-4xl text-ok" aria-hidden>
          <Check size={40} strokeWidth={2.6} />
        </div>
        <h1 className="text-[28px] font-bold leading-tight">Rahmat, {a.subjectName.split(" ")[0]}!</h1>
        <p className="mt-3 text-[17px] text-tx2">
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
