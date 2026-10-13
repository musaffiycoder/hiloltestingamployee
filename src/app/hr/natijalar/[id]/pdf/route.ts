import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/auth";
import { loadReport } from "@/lib/report";
import { ReportDocument } from "@/lib/pdf/report-document";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const slug = (t: string) =>
  t
    .toLowerCase()
    .replace(/[ʻʼ'`’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "natija";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await ctx.params;
  const report = await loadReport(id);
  if (!report) return new Response("Natija topilmadi", { status: 404 });

  const buf = await renderToBuffer(React.createElement(ReportDocument, { r: report }) as never);
  await db.auditLog.create({ data: { actorId: user.id, action: "result.pdf", entity: "Attempt", entityId: id, meta: {} } }).catch(() => {});
  const d = (report.finishedAt ?? report.startedAt).toISOString().slice(0, 10);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="hisobot-${slug(report.subjectName)}-${d}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
