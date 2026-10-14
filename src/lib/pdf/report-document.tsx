import path from "node:path";
import React from "react";
import { Circle, Document, Font, Page, Path, Polygon, Line, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { ReportData } from "@/lib/report";

const FONT_DIR = path.join(process.cwd(), "src/assets/fonts");
Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(FONT_DIR, "inter-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "inter-latin-500-normal.woff"), fontWeight: 500 },
    { src: path.join(FONT_DIR, "inter-latin-600-normal.woff"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "inter-latin-700-normal.woff"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((w) => [w]);

const C = {
  navy: "#0A1828",
  navy2: "#14243A",
  cream: "#F8F5EE",
  card: "#FFFFFF",
  line: "#E5DECF",
  tx: "#14243A",
  tx2: "#5D6B7C",
  br: "#F26B1D",
  brd: "#B84A08",
  tint: "#FFE9D8",
  ok: "#1E7B46",
  okT: "#DDF1E5",
  warn: "#A15C00",
  warnT: "#FFF0CC",
  bad: "#B3261E",
  badT: "#FBDDDA",
};


const s = StyleSheet.create({
  page: { backgroundColor: C.cream, paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontFamily: "Inter", fontSize: 9.5, color: C.tx, lineHeight: 1.45 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  brand: { fontSize: 9, fontWeight: 700, color: C.brd, letterSpacing: 1.2 },
  brandSub: { fontSize: 8, color: C.tx2 },
  hero: { backgroundColor: C.navy, borderRadius: 14, padding: 20, color: C.cream },
  heroKicker: { fontSize: 8.5, color: "#F2B27E", letterSpacing: 1, fontWeight: 600 },
  heroTitle: { fontSize: 22, fontWeight: 700, marginTop: 6, color: "#FFFFFF", lineHeight: 1.2 },
  heroMeta: { fontSize: 10, color: "#C9D3E0", marginTop: 8 },
  h2: { fontSize: 12.5, fontWeight: 700, marginTop: 16, marginBottom: 7, color: C.navy },
  h3: { fontSize: 10, fontWeight: 700, color: C.navy },
  card: { backgroundColor: C.card, borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: C.line },
  row: { flexDirection: "row" },
  muted: { color: C.tx2, fontSize: 8.5 },
  chip: { fontSize: 8.5, fontWeight: 600, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  bullet: { flexDirection: "row", marginTop: 3 },
  footer: { position: "absolute", left: 36, right: 36, bottom: 20, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.tx2 },
});

const fmtDate = (d: Date | null) => {
  if (!d) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function Section({ title, children, minAhead = 110, pageBreak = false }: { title: string; children: React.ReactNode; minAhead?: number; pageBreak?: boolean }) {
  // Fragment: sarlavha sahifaning bevosita farzandi bo'lishi kerak (minPresenceAhead shunda ishlaydi)
  return (
    <>
      <Text style={s.h2} break={pageBreak} minPresenceAhead={minAhead}>
        {title}
      </Text>
      {children}
    </>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 9.5, lineHeight: 1.55 }}>{children}</Text>;
}

function Bullets({ items, color = C.tx2 }: { items: string[]; color?: string }) {
  if (!items.length) return <Text style={s.muted}>—</Text>;
  return (
    <View>
      {items.map((t, i) => (
        <View key={i} style={s.bullet} wrap={false}>
          <Text style={{ width: 10, color }}>•</Text>
          <Text style={{ flex: 1 }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function ScoreRing({ pct, color }: { pct: number; color: string }) {
  const size = 118;
  const r = 48;
  const cx = size / 2;
  const cy = size / 2;
  const arc = (p: number) => {
    const a = Math.min(Math.max(p, 0.001), 99.99) / 100 * Math.PI * 2 - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    const large = p > 50 ? 1 : 0;
    return `M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
  };
  return (
    <View style={{ width: size, alignItems: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke="#EFE8DA" strokeWidth={10} fill="none" />
        <Path d={arc(pct)} stroke={color} strokeWidth={10} fill="none" strokeLinecap="round" />
      </Svg>
      <View style={{ position: "absolute", top: 0, left: 0, width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 26, fontWeight: 700, color: C.navy, lineHeight: 1 }}>{Math.round(pct)}%</Text>
        <Text style={{ fontSize: 7.5, color: C.tx2, marginTop: 5, lineHeight: 1 }}>umumiy moslik</Text>
      </View>
    </View>
  );
}

function Radar({ comps }: { comps: ReportData["competencies"] }) {
  const size = 230;
  const cx = size / 2;
  const cy = size / 2;
  const R = 78;
  const n = comps.length;
  if (n < 3) return null;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = (v / 5) * R;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).map((x) => x.toFixed(1)).join(",")).join(" ");
  return (
    <Svg width={size} height={size}>
      {[1, 2, 3, 4, 5].map((g) => (
        <Polygon key={g} points={poly(comps.map(() => g))} fill="none" stroke={g === 5 ? "#CFC6B2" : "#E7DFCF"} strokeWidth={0.6} />
      ))}
      {comps.map((c, i) => {
        const [x, y] = pt(i, 5);
        return <Line key={c.code} x1={cx} y1={cy} x2={x} y2={y} stroke="#E7DFCF" strokeWidth={0.6} />;
      })}
      <Polygon points={poly(comps.map((c) => c.target))} fill="none" stroke={C.navy} strokeWidth={1} strokeDasharray="3 2" />
      <Polygon points={poly(comps.map((c) => c.level ?? 0))} fill={C.br} fillOpacity={0.28} stroke={C.br} strokeWidth={1.6} />
      {comps.map((c, i) => {
        const [x, y] = pt(i, 5.9);
        return (
          <Text key={c.code} x={x} y={y + 3} style={{ fontSize: 8, fontWeight: 600 }} fill={C.navy2} textAnchor="middle">
            {c.code}
          </Text>
        );
      })}
    </Svg>
  );
}

function CompRow({ c }: { c: ReportData["competencies"][number] }) {
  const lvl = c.level ?? 0;
  const gap = c.level === null ? null : c.level - c.target;
  const tone = gap === null ? C.tx2 : gap >= 0 ? C.ok : gap >= -1 ? C.warn : C.bad;
  return (
    <View style={{ marginBottom: 7 }} wrap={false}>
      <View style={s.row}>
        <Text style={{ width: 24, fontWeight: 700, color: C.brd }}>{c.code}</Text>
        <Text style={{ flex: 1, fontWeight: 500 }}>
          {c.name}
          {c.critical ? <Text style={{ fontWeight: 700, color: C.brd, fontSize: 8 }}> KRITIK</Text> : null}
        </Text>
        <Text style={{ width: 92, textAlign: "right", color: tone, fontWeight: 600 }}>
          {c.level === null ? "baholanmagan" : `${c.level} / ${c.target}  ${gap! > 0 ? "+" : ""}${gap}`}
        </Text>
      </View>
      <View style={{ marginLeft: 24, marginTop: 3, height: 7, backgroundColor: "#EFE8DA", borderRadius: 4 }}>
        <View style={{ width: `${(lvl / 5) * 100}%`, height: 7, backgroundColor: tone === C.tx2 ? "#B5AE9E" : tone === C.ok ? C.ok : tone === C.warn ? C.br : C.bad, borderRadius: 4 }} />
        <View style={{ position: "absolute", left: `${(c.target / 5) * 100}%`, top: -2, width: 1.5, height: 11, backgroundColor: C.navy }} />
      </View>
      <Text style={{ marginLeft: 24, marginTop: 2, fontSize: 7.5, color: C.tx2 }}>
        {c.type === "HARD" ? "Kasbiy" : "Xulq"} · vazn {c.weight}% · {c.answered} ta savol · {c.levelName}
      </Text>
    </View>
  );
}

export function ReportDocument({ r }: { r: ReportData }) {
  const a = r.analysis;
  const vc = { fg: C.br, bg: C.tint };
  const isEmp = r.mode === "EVALUATION";
  const comps = [...r.competencies].sort((x, y) => (x.level ?? 0) - x.target - ((y.level ?? 0) - y.target));
  const insights = a?.competencyInsights ?? [];

  return (
    <Document title={`Baholash hisoboti — ${r.subjectName}`} author="Hilol Nashr · Baholash" subject={r.positionTitle}>
      <Page size="A4" style={s.page}>
        <View style={s.topBar}>
          <Text style={s.brand}>HILOL NASHR · BAHOLASH</Text>
          <Text style={s.brandSub}>Maxfiy · faqat HR uchun</Text>
        </View>

        <View style={s.hero}>
          <Text style={s.heroKicker}>{isEmp ? "XODIMNI BAHOLASH HISOBOTI" : "NOMZODNI BAHOLASH HISOBOTI"}</Text>
          <Text style={s.heroTitle}>{r.subjectName}</Text>
          <Text style={s.heroMeta}>
            {r.positionTitle} · {fmtDate(r.finishedAt ?? r.startedAt)}
            {r.durationMin ? ` · ${r.durationMin} daqiqa` : ""}
          </Text>
        </View>

        <View style={[s.row, { marginTop: 14, gap: 14 }]}>
          <View style={[s.card, { width: 150, alignItems: "center", paddingVertical: 14 }]}>
            <ScoreRing pct={r.overallPct} color={vc.fg} />
          </View>
          <View style={[s.card, { flex: 1 }]}>
            <Text style={s.h3}>Yakuniy baho</Text>
            <View style={[s.row, { marginTop: 8, flexWrap: "wrap" }]}>
              {[
                ["Umumiy moslik", `${Math.round(r.overallPct)}%`],
                ["Qizil bayroq", r.redFlags.length ? `${r.redFlags.length} ta` : "yo'q"],
                ["Vaznli daraja", r.weightedLevel === null ? "—" : `${r.weightedLevel.toFixed(1)} / 5`],
                ["Kritik kompetensiya", r.criticalFail ? "talabdan past" : "me'yorda"],
              ].map(([k, v]) => (
                <View key={k} style={{ width: "50%", marginBottom: 8 }}>
                  <Text style={s.muted}>{k}</Text>
                  <Text style={{ fontSize: 13, fontWeight: 700, color: (k === "Kritik kompetensiya" && r.criticalFail) || (k === "Qizil bayroq" && r.redFlags.length) ? C.bad : C.navy }}>{v}</Text>
                </View>
              ))}
            </View>
            {r.redFlags.length > 0 && (
              <View style={{ backgroundColor: C.badT, borderRadius: 6, padding: 6, marginTop: 2 }}>
                <Text style={{ color: C.bad, fontWeight: 700, fontSize: 8.5 }}>Qizil bayroq: {r.redFlags.length} ta</Text>
              </View>
            )}
            {r.needsReview && (
              <Text style={{ marginTop: 4, color: C.warn, fontSize: 8.5 }}>Ba'zi ochiq javoblar hali inson tomonidan tekshirilmagan — natija vaqtinchalik.</Text>
            )}
          </View>
        </View>

        {a?.executiveSummary ? (
          <Section title="Qisqa xulosa">
            <View style={[s.card, { backgroundColor: "#FFF8F0", borderColor: "#F2D5B8" }]}>
              <Para>{a.executiveSummary}</Para>
            </View>
          </Section>
        ) : null}

        <Section title="Kompetensiyalar profili" pageBreak>
          <View style={[s.row, { gap: 12 }]}>
            <View style={[s.card, { width: 245, alignItems: "center" }]}>
              <Radar comps={r.competencies} />
              <Text style={[s.muted, { marginTop: 2 }]}>to'ldirilgan — natija · punktir — talab</Text>
            </View>
            <View style={{ flex: 1 }}>
              {comps.slice(0, 5).map((c) => (
                <CompRow key={c.code} c={c} />
              ))}
            </View>
          </View>
          {comps.length > 5 && (
            <View style={[s.card, { marginTop: 10 }]}>
              {comps.slice(5).map((c) => (
                <CompRow key={c.code} c={c} />
              ))}
            </View>
          )}
        </Section>

        {a ? (
          <>
            <Section title="Umumiy tahlil">
              <View style={s.card}>
                <Para>{a.overallNarrative}</Para>
              </View>
            </Section>

            <Section title="SWOT" minAhead={140}>
              <View style={{ gap: 8 }}>
                {[
                  [
                    ["Kuchli tomonlar", a.strengths, C.ok, C.okT],
                    ["Zaif tomonlar", a.weaknesses, C.warn, C.warnT],
                  ],
                  [
                    [isEmp ? "O'sish imkoniyatlari" : "Imkoniyatlar", a.opportunities, C.brd, C.tint],
                    ["Xavflar", a.threats, C.bad, C.badT],
                  ],
                ].map((pair, pi) => (
                  <View key={pi} style={[s.row, { gap: 8 }]} wrap={false}>
                    {pair.map(([title, items, fg, bg]) => (
                      <View key={title as string} style={[s.card, { flex: 1, borderTopWidth: 2.5, borderTopColor: fg as string }]}>
                        <Text style={[s.chip, { color: fg as string, backgroundColor: bg as string, alignSelf: "flex-start", marginBottom: 4 }]}>{title as string}</Text>
                        <Bullets items={items as string[]} color={fg as string} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </Section>

            {a.swotStrategy ? (
              <View style={[s.card, { marginTop: 8, borderLeftWidth: 3, borderLeftColor: C.br }]} wrap={false}>
                <Text style={s.h3}>SWOT xulosasi</Text>
                <Text style={{ marginTop: 3 }}>{a.swotStrategy}</Text>
              </View>
            ) : null}

            {insights.length > 0 && (
              <Section title="Kompetensiyalar bo'yicha chuqur tahlil" minAhead={120}>
                {insights.map((c) => (
                  <View key={c.code} style={[s.card, { marginBottom: 8 }]} wrap={false}>
                    <Text style={s.h3}>
                      {c.code} · {c.name}
                    </Text>
                    <Text style={{ marginTop: 4 }}>{c.analysis}</Text>
                    {c.evidence ? (
                      <Text style={{ marginTop: 4, color: C.tx2 }}>
                        <Text style={{ fontWeight: 600 }}>Dalil: </Text>
                        {c.evidence}
                      </Text>
                    ) : null}
                    {c.reliability ? (
                      <Text style={{ marginTop: 2, color: C.tx2 }}>
                        <Text style={{ fontWeight: 600 }}>Ishonchlilik: </Text>
                        {c.reliability}
                      </Text>
                    ) : null}
                    {c.nextStep ? (
                      <Text style={{ marginTop: 2, color: C.brd }}>
                        <Text style={{ fontWeight: 700 }}>Keyingi qadam: </Text>
                        {c.nextStep}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </Section>
            )}

            {(a.errorDiagnostics?.length ?? 0) > 0 && (
              <Section title="Xatolar diagnostikasi" minAhead={120}>
                {a.errorDiagnostics.map((e, i) => (
                  <View key={i} style={[s.card, { marginBottom: 6 }]} wrap={false}>
                    <Text style={s.h3}>
                      Savol {e.question} · {e.competency}
                    </Text>
                    <Text style={{ marginTop: 3 }}>
                      <Text style={{ fontWeight: 600 }}>Tanlov: </Text>
                      {e.chose}
                    </Text>
                    <Text style={{ marginTop: 2 }}>
                      <Text style={{ fontWeight: 600 }}>Nimani ko'rsatadi: </Text>
                      {e.shows}
                    </Text>
                    <Text style={{ marginTop: 2, color: C.brd }}>
                      <Text style={{ fontWeight: 700 }}>Tuzatish: </Text>
                      {e.fix}
                    </Text>
                  </View>
                ))}
              </Section>
            )}

            <Section title="Javob naqshlari va ishonchlilik" minAhead={120}>
              <View style={s.card}>
                {(
                  [
                    ["Qiyinlik bo'yicha", a.answerPatterns.difficulty],
                    ["Noto'g'ri variantlar", a.answerPatterns.distractors],
                    ["Vaqt", a.answerPatterns.time],
                    ["Qiyoslash", a.answerPatterns.comparison],
                    ["Natijaga ishonch", a.answerPatterns.reliability ?? ""],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <View key={k} style={{ marginBottom: 6 }} wrap={false}>
                      <Text style={{ fontSize: 7.5, fontWeight: 700, color: C.tx2, letterSpacing: 0.6 }}>{k.toUpperCase()}</Text>
                      <Text style={{ marginTop: 1 }}>{v}</Text>
                    </View>
                  ))}
              </View>
            </Section>

            {(a.interviewQuestions?.length ?? 0) > 0 && (
              <Section title={isEmp ? "Rahbar bilan suhbat uchun savollar" : "Intervyu uchun savollar"} minAhead={120}>
                {a.interviewQuestions.map((q, i) => (
                  <View key={i} style={[s.card, { marginBottom: 6 }]} wrap={false}>
                    <Text style={{ fontWeight: 600 }}>
                      {i + 1}. {q.question}
                    </Text>
                    <Text style={{ marginTop: 3, color: C.tx2 }}>Tekshiradi: {q.verifies}</Text>
                    <Text style={{ marginTop: 1, color: C.ok }}>Yaxshi javobda: {q.lookFor}</Text>
                  </View>
                ))}
              </Section>
            )}

            {(a.roleRisks?.length ?? 0) > 0 && (
              <Section title={isEmp ? "Lavozimdagi xavflar" : "Qabul qilinsa — xavflar (dastlabki 3 oy)"} minAhead={90}>
                <View style={s.card}>
                  <Bullets items={a.roleRisks} color={C.bad} />
                </View>
              </Section>
            )}

            <Section title="Rivojlantirish rejasi" minAhead={140}>
              {a.developmentPlan.map((d, i) => (
                <View key={i} style={[s.card, { marginBottom: 6 }]} wrap={false}>
                  <View style={s.row}>
                    <Text style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.tint, color: C.brd, textAlign: "center", fontWeight: 700, fontSize: 9, paddingTop: 3 }}>
                      {d.priority}
                    </Text>
                    <Text style={[s.h3, { marginLeft: 8, flex: 1, paddingTop: 2 }]}>{d.area}</Text>
                    {d.horizon ? <Text style={[s.chip, { backgroundColor: C.cream, color: C.navy }]}>{d.horizon}</Text> : null}
                  </View>
                  <Text style={{ marginTop: 4 }}>{d.recommendation}</Text>
                  <Text style={{ marginTop: 3, color: C.tx2 }}>
                    {d.format} · {d.courseSuggestion} · {d.estimatedDuration}
                  </Text>
                  {(d.resources?.length ?? 0) > 0 && (
                    <View style={{ marginTop: 5, backgroundColor: C.cream, borderRadius: 6, padding: 6 }}>
                      {d.resources.map((rs, k) => (
                        <View key={k} style={{ marginBottom: k < d.resources.length - 1 ? 4 : 0 }}>
                          <Text>
                            <Text style={{ fontWeight: 700, color: C.brd, fontSize: 7.5 }}>{rs.kind.toUpperCase()}  </Text>
                            <Text style={{ fontWeight: 600 }}>{rs.title}</Text>
                            <Text style={{ color: C.tx2 }}> · {rs.provider}</Text>
                          </Text>
                          <Text style={{ color: C.tx2, fontSize: 8.5 }}>{rs.why}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {d.successMetric ? (
                    <Text style={{ marginTop: 2, color: C.ok }}>
                      <Text style={{ fontWeight: 700 }}>Muvaffaqiyat mezoni: </Text>
                      {d.successMetric}
                    </Text>
                  ) : null}
                </View>
              ))}
            </Section>

            <Section title="Yakuniy tavsiya" minAhead={120}>
              <View style={[s.card, { borderLeftWidth: 3, borderLeftColor: vc.fg }]}>
                <Para>{a.recommendation}</Para>
                {(a.recommendationReasons?.length ?? 0) > 0 && (
                  <View style={{ marginTop: 6 }}>
                    <Bullets items={a.recommendationReasons} color={vc.fg} />
                  </View>
                )}
              </View>
              <Text style={[s.muted, { marginTop: 5 }]}>Yakuniy qaror HR da. Foiz va darajalar formuladan olingan; AI matni asos va tavsiya.</Text>
            </Section>

            {(a.keyConcerns?.length ?? 0) > 0 && (
              <Section title="Javob kaliti bo'yicha e'tibor (HR tekshirsin)">
                <View style={s.card}>
                  {a.keyConcerns.map((k, i) => (
                    <Text key={i} style={{ marginBottom: 3 }}>
                      <Text style={{ fontWeight: 700 }}>Savol {k.question}: </Text>
                      {k.concern}
                    </Text>
                  ))}
                </View>
              </Section>
            )}

            {(a.dataGaps?.length ?? 0) > 0 && (
              <Section title="Ishonchlilikni oshirish uchun" minAhead={90}>
                {a.dataGaps.map((g, i) => {
                  const gg = g as unknown as { gap?: string; why?: string; howToClose?: string } | string;
                  const gap = typeof gg === "string" ? gg : gg.gap;
                  return (
                    <View key={i} style={[s.card, { marginBottom: 6 }]} wrap={false}>
                      <Text style={{ fontWeight: 600 }}>{gap}</Text>
                      {typeof gg !== "string" && gg.why ? <Text style={{ marginTop: 2, color: C.tx2 }}>{gg.why}</Text> : null}
                      {typeof gg !== "string" && gg.howToClose ? (
                        <Text style={{ marginTop: 2, color: C.brd }}>
                          <Text style={{ fontWeight: 700 }}>Nima qilish kerak: </Text>
                          {gg.howToClose}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </Section>
            )}
          </>
        ) : (
          <Section title="AI tahlil">
            <View style={s.card}>
              <Text style={{ color: C.tx2 }}>Bu natija uchun AI tahlili hali tayyor emas. Quyida formuladan olingan natijalar keltirilgan.</Text>
            </View>
          </Section>
        )}

        {r.hrContext ? (
          <Section title="HR kontekst (real ish natijalari)" minAhead={80}>
            <View style={s.card}>
              <Text>{r.hrContext}</Text>
            </View>
          </Section>
        ) : null}

        <Section title="Test sharoiti" minAhead={90}>
          <View style={[s.card, s.row, { flexWrap: "wrap" }]}>
            {[
              ["Boshlangan", fmtDate(r.startedAt)],
              ["Yakunlangan", fmtDate(r.finishedAt)],
              ["Davomiyligi", r.durationMin ? `${r.durationMin} daqiqa` : "—"],
              ["Savollar", String(r.questions.length)],
              ["Oyna fokusi yo'qolgan", `${r.signals.focusLost} marta`],
              ["Matn qo'yilgan (paste)", `${r.signals.paste} marta`],
            ].map(([k, v]) => (
              <View key={k} style={{ width: "33%", marginBottom: 6 }}>
                <Text style={s.muted}>{k}</Text>
                <Text style={{ fontWeight: 600 }}>{v}</Text>
              </View>
            ))}
          </View>
          <Text style={[s.muted, { marginTop: 4 }]}>Kuzatuv signallari dalil emas — faqat natija ishonchliligini baholashda qo'shimcha ma'lumot.</Text>
        </Section>

        <Section title="Ilova: savollar bo'yicha natija" minAhead={120}>
          <View style={s.card}>
            <View style={[s.row, { borderBottomWidth: 0.5, borderBottomColor: C.line, paddingBottom: 3 }]}>
              <Text style={{ width: 22, fontWeight: 700 }}>№</Text>
              <Text style={{ width: 28, fontWeight: 700 }}>Komp.</Text>
              <Text style={{ width: 24, fontWeight: 700 }}>Dar.</Text>
              <Text style={{ flex: 1, fontWeight: 700 }}>Savol</Text>
              <Text style={{ width: 40, textAlign: "right", fontWeight: 700 }}>Ball</Text>
              <Text style={{ width: 34, textAlign: "right", fontWeight: 700 }}>Vaqt</Text>
            </View>
            {r.questions.map((q) => {
              const sc = q.score;
              const col = sc === null ? C.tx2 : sc >= 0.7 ? C.ok : sc >= 0.4 ? C.warn : C.bad;
              return (
                <View key={q.n} style={[s.row, { paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#EFE8DA" }]} wrap={false}>
                  <Text style={{ width: 22 }}>{q.n}</Text>
                  <Text style={{ width: 28 }}>{q.comp}</Text>
                  <Text style={{ width: 24 }}>{q.level}</Text>
                  <Text style={{ flex: 1, fontSize: 8.5 }}>{q.stem.length > 120 ? q.stem.slice(0, 117) + "..." : q.stem}</Text>
                  <Text style={{ width: 40, textAlign: "right", color: col, fontWeight: 600 }}>{sc === null ? "—" : `${Math.round(sc * 100)}%`}</Text>
                  <Text style={{ width: 34, textAlign: "right", color: C.tx2 }}>{q.timeSec}s</Text>
                </View>
              );
            })}
          </View>
        </Section>

        <Text style={{ position: "absolute", left: 36, bottom: 20, fontSize: 7.5, color: C.tx2 }} fixed>
          {r.subjectName} · {r.positionTitle}
        </Text>
        <Text style={{ position: "absolute", right: 36, bottom: 20, fontSize: 7.5, color: C.tx2 }} fixed>
          Maxfiy · Hilol Nashr Baholash
        </Text>
      </Page>
    </Document>
  );
}
