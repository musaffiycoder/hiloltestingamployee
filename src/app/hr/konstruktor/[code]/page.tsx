import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getPositionPlan } from "@/lib/test-config";
import { BuilderEditor } from "./editor";

export const metadata: Metadata = { title: "Test konstruktori" };

export default async function BuilderPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const { code } = await params;
  const position = await db.position.findUnique({ where: { code }, select: { id: true, title: true } });
  if (!position) notFound();
  const plan = await getPositionPlan(position.id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/hr/konstruktor" className="inline-flex items-center gap-1 text-[17px] text-brd">
        <ChevronLeft size={22} aria-hidden className="-ml-1.5" /> Test konstruktori
      </Link>
      <header className="px-1">
        <h2 className="text-[30px] font-bold leading-tight">{position.title}</h2>
        <p className="mt-1 text-[15px] text-tx2">
          O'zgarishlar faqat yangi boshlanadigan testlarga ta'sir qiladi; boshlangan va yakunlangan testlar o'zgarmaydi.
        </p>
      </header>
      <BuilderEditor plan={plan} readOnly={user.role === "MANAGER"} />
    </div>
  );
}
