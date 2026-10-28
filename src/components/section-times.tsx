"use client";

import { TriangleAlert } from "lucide-react";
import { Ico } from "@/components/ui";
import { SECTION_LABEL, type Section } from "@/lib/sections";

export type SectionTimes = Record<Section, number | null>;
export type SectionEstimates = Record<Section, { count: number; estimatedMin: number }>;

const seg = (on: boolean) =>
  `flex h-8 flex-1 items-center justify-center rounded-[8px] px-2 text-[13px] font-semibold ${on ? "bg-card text-tx shadow-sm" : "text-tx2"}`;

/** Amaldagi bo'lim vaqti (daqiqa): qo'lda belgilangan yoki savollar vaqtining yig'indisi. */
export const sectionMinutes = (est: SectionEstimates, times: SectionTimes, sec: Section) =>
  est[sec].count ? (times[sec] ?? Math.max(1, est[sec].estimatedMin)) : 0;

export const validSectionTimes = (times: SectionTimes) =>
  (["closed", "open"] as const).every((s) => times[s] === null || (times[s]! >= 5 && times[s]! <= 600));

/**
 * Ikki bo'lim vaqti: test (yopiq) savollar va yozma savollar. Nomzod avval test savollarini,
 * keyin yozma savollarni ishlaydi; har bo'limning taymeri alohida.
 */
export function SectionTimeFields({
  estimates,
  value,
  onChange,
  readOnly,
}: {
  estimates: SectionEstimates;
  value: SectionTimes;
  onChange: (v: SectionTimes) => void;
  readOnly: boolean;
}) {
  const sections = (["closed", "open"] as const).filter((s) => estimates[s].count > 0);
  if (!sections.length) return <p className="text-[13px] text-tx2">Testda savol yo&apos;q.</p>;
  return (
    <div className="flex flex-col gap-4">
      {sections.map((sec, i) => {
        const est = estimates[sec];
        const manual = value[sec] !== null;
        const min = value[sec] ?? est.estimatedMin;
        const tight = manual && min < est.estimatedMin * 0.7;
        return (
          <div key={sec}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-[15px] font-semibold">
                {sections.length > 1 ? `${i + 1}. ` : ""}
                {SECTION_LABEL[sec]}
              </span>
              <span className="text-[13px] text-tx2">~{est.count} ta savol</span>
            </div>
            <div className="flex rounded-[10px] bg-soft p-0.5" role="radiogroup" aria-label={`${SECTION_LABEL[sec]} vaqti`}>
              <button
                type="button"
                role="radio"
                aria-checked={!manual}
                disabled={readOnly}
                onClick={() => onChange({ ...value, [sec]: null })}
                className={seg(!manual)}
              >
                Savollar bo&apos;yicha (~{est.estimatedMin} daq)
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={manual}
                disabled={readOnly}
                onClick={() => onChange({ ...value, [sec]: Math.max(5, est.estimatedMin) })}
                className={seg(manual)}
              >
                Qo&apos;lda
              </button>
            </div>
            {manual && (
              <label className="mt-2 flex items-center gap-2 text-[15px]">
                <input
                  type="number"
                  min={5}
                  max={600}
                  value={min}
                  disabled={readOnly}
                  onChange={(e) => onChange({ ...value, [sec]: Number(e.target.value) || 0 })}
                  aria-label={`${SECTION_LABEL[sec]}: daqiqa`}
                  className="h-9 w-20 rounded-[10px] bg-soft px-3 text-center text-[17px] tabular-nums outline-none focus:ring-2 focus:ring-br/40"
                />
                daqiqa
              </label>
            )}
            {tight && (
              <p className="mt-2 text-[13px] font-medium text-warn">
                <Ico icon={TriangleAlert} size={13} className="mr-1" />
                Savollar uchun tavsiya etilganidan ancha kam (~{est.estimatedMin} daq) — nomzodlar ulgurmasligi mumkin.
              </p>
            )}
          </div>
        );
      })}
      <p className="text-[13px] text-tx2">
        Nomzod avval test savollarini, keyin yozma savollarni ishlaydi. Bo&apos;limlar aralashmaydi; test bo&apos;limidan o&apos;tgach unga qaytib
        bo&apos;lmaydi.
      </p>
    </div>
  );
}
