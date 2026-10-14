import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PositionsBrowser, type PositionCard } from "./browser";

export const metadata: Metadata = { title: "Lavozim kartalari" };

export default async function PositionsPage() {
  await requireUser();
  const positions = await db.position.findMany({
    orderBy: { title: "asc" },
    include: {
      competencies: {
        orderBy: { sortOrder: "asc" },
        // Faqat faol savollar — arxivdagilar testga tushmaydi
        include: { questions: { where: { status: "ACTIVE" }, select: { level: true } } },
      },
    },
  });

  const data: PositionCard[] = positions.map((p) => ({
    code: p.code,
    title: p.title,
    competencies: p.competencies.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      type: c.type,
      target: c.target,
      weight: c.weight,
      critical: c.critical,
      derived: c.derived,
      counts: [1, 2, 3, 4, 5].map((l) => c.questions.filter((q) => q.level === l).length),
    })),
  }));

  return <PositionsBrowser positions={data} />;
}
