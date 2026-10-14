"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { commitImport, previewImport, type PreviewResult } from "../actions";
import { Check, ChevronRight, CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import { Ico } from "@/components/ui";

export function ImportTool({ prompt }: { prompt: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">("DRAFT");
  const [skipDup, setSkipDup] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const check = () => {
    setMsg(null);
    start(async () => setPreview(await previewImport(text)));
  };
  const doImport = () => {
    start(async () => {
      try {
        const r = await commitImport(text, status, skipDup);
        if (!r.ok) return setMsg(r.error);
        router.push(`/hr/savollar?status=${status}`);
        router.refresh();
      } catch {
        setMsg("Import qilib bo'lmadi. Ruxsatingizni (faqat ko'rish huquqi) yoki ulanishni tekshiring.");
      }
    });
  };

  const sectionTitle = "mb-2 px-4 text-[13px] font-semibold uppercase tracking-wide text-tx2";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <details className="overflow-hidden rounded-2xl bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-[17px] [&::-webkit-details-marker]:hidden">
          <span>Gemini uchun tayyor prompt</span>
          <ChevronRight size={16} aria-hidden className="shrink-0 text-tx2" />
        </summary>
        <div className="border-t border-line p-4">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-soft p-3 font-mono text-[12px] leading-relaxed">{prompt}</pre>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(prompt);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="mt-3 h-10 rounded-full bg-tint px-5 text-[15px] font-semibold text-brd"
          >
            {copied ? (
              <>
                Nusxalandi <Ico icon={Check} />
              </>
            ) : (
              "Promptni nusxalash"
            )}
          </button>
        </div>
      </details>

      <div>
        <div className={sectionTitle}>JSON (Gemini natijasini shu yerga qo'ying)</div>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
          }}
          rows={12}
          spellCheck={false}
          placeholder='[{"position":"backend","competency":"H2","level":3,"type":"MCQ_SINGLE","stem":"…","options":["…","…","…","…"],"correct":1}]'
          className="w-full rounded-2xl bg-card p-4 font-mono text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-br/40"
        />
      </div>

      <button
        onClick={check}
        disabled={pending || !text.trim()}
        className="h-[50px] rounded-full bg-brf text-[17px] font-semibold text-onbr disabled:opacity-50"
      >
        {pending && !preview ? "Tekshirilmoqda…" : "Tekshirish"}
      </button>

      {preview && !preview.ok && (
        <p role="alert" className="rounded-2xl bg-bad-t p-4 text-[15px] text-bad">{preview.error}</p>
      )}

      {preview?.ok && (
        <>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-card p-4">
              <div className="text-[28px] font-bold text-ok">{preview.valid}</div>
              <div className="text-[13px] text-tx2">to'g'ri</div>
            </div>
            <div className="rounded-2xl bg-card p-4">
              <div className={`text-[28px] font-bold ${preview.invalid ? "text-bad" : "text-tx2"}`}>{preview.invalid}</div>
              <div className="text-[13px] text-tx2">xatolik bilan</div>
            </div>
          </div>

          {preview.batchWarnings.length > 0 && (
            <ul className="rounded-2xl bg-warn-t px-4 py-3 text-[15px]">
              {preview.batchWarnings.map((w) => (
                <li key={w.code} className="py-1">
                  <Ico icon={TriangleAlert} className="mr-1" />
                  {w.message}
                </li>
              ))}
            </ul>
          )}

          <ul className="overflow-hidden rounded-2xl bg-card">
            {preview.items.map((it, i) => (
              <li key={it.index} className={`px-4 py-3 ${i < preview.items.length - 1 ? "border-b border-line" : ""}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 ${it.ok ? "text-ok" : "text-bad"}`} aria-hidden>
                    {it.ok ? <CircleCheck size={18} /> : <CircleX size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium">{it.index + 1}. {it.title || "(matn yo'q)"}</div>
                    <div className="text-[13px] text-tx2">{it.where}{it.duplicate ? " · takror (bazada bor)" : ""}</div>
                    {it.errors.map((e, k) => (
                      <div key={k} className="mt-1 text-[13px] font-medium text-bad">• {e}</div>
                    ))}
                    {it.warnings.map((w) => (
                      <div key={w.code} className={`mt-1 text-[13px] ${w.severity === "warn" ? "text-warn" : "text-tx2"}`}>
                        <Ico icon={w.severity === "warn" ? TriangleAlert : Info} className="mr-1" />
                        {w.message}
                      </div>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="overflow-hidden rounded-2xl bg-card">
            <div className="flex items-center justify-between px-4 py-3 text-[17px]">
              <span>Holat</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as "DRAFT" | "ACTIVE")} className="bg-transparent text-right text-brd">
                <option value="DRAFT">Qoralama (keyin faollashtiraman)</option>
                <option value="ACTIVE">Darhol faol</option>
              </select>
            </div>
            <div className="ml-4 h-px bg-line" />
            <label className="flex items-center justify-between gap-3 px-4 py-3 text-[17px]">
              <span>Takrorlarni o'tkazib yuborish</span>
              <input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} className="ios-switch" />
            </label>
          </div>

          {msg && <p role="alert" className="text-[15px] font-medium text-bad">{msg}</p>}
          <button
            onClick={doImport}
            disabled={pending || preview.valid === 0}
            className="h-[50px] rounded-full bg-brf text-[17px] font-semibold text-onbr disabled:opacity-50"
          >
            {pending ? "Import qilinmoqda…" : `${preview.valid} ta savolni import qilish`}
          </button>
        </>
      )}
    </div>
  );
}
