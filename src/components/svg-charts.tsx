// Server-render qilinadigan SVG diagrammalar (v2 dizayn): radar, halqa, sparkline.
// Ranglar `style` orqali CSS o'zgaruvchilardan olinadi (light/dark avtomatik).

export type RadarAxis = { code: string; name: string; critical?: boolean };
export type RadarSeries = { name: string; values: number[]; color: string; dashed?: boolean; fill?: boolean };

const CX = 180;
const CY = 160;
const R = 105;

function pt(i: number, n: number, v: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [CX + ((R * v) / 5) * Math.cos(a), CY + ((R * v) / 5) * Math.sin(a)];
}

export function Radar({ axes, series }: { axes: RadarAxis[]; series: RadarSeries[] }) {
  const n = axes.length;
  if (n < 3) return <p className="p-6 text-sm text-tx2">Diagramma uchun kamida 3 ta kompetensiya kerak.</p>;
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, n, v).join(",")).join(" ");
  return (
    <svg viewBox="0 0 360 320" className="h-auto w-full" role="img" aria-label="Kompetensiyalar radar diagrammasi">
      {[1, 2, 3, 4, 5].map((l) => (
        <polygon
          key={l}
          points={poly(Array(n).fill(l))}
          style={{ fill: "none", stroke: "var(--line)", strokeWidth: l === 5 ? 1.2 : 0.8 }}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, n, 5);
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y} style={{ stroke: "var(--line)", strokeWidth: 0.8 }} />;
      })}
      {series.map((s) => (
        <polygon
          key={s.name}
          points={poly(s.values)}
          style={{
            fill: s.fill ? s.color : "none",
            fillOpacity: s.fill ? 0.22 : 0,
            stroke: s.color,
            strokeWidth: s.dashed ? 2 : 2.5,
            strokeDasharray: s.dashed ? "5 4" : undefined,
            strokeLinejoin: "round",
          }}
        />
      ))}
      {axes.map((a, i) => {
        const [x, y] = pt(i, n, 6.1);
        const anchor = Math.abs(x - CX) < 10 ? "middle" : x > CX ? "start" : "end";
        return (
          <text
            key={a.code}
            x={x}
            y={y + 4}
            textAnchor={anchor}
            style={{ fill: "var(--tx2)", fontSize: 11, fontWeight: 700 }}
          >
            <title>{a.name}</title>
            {a.code}
            {a.critical ? " ⛨" : ""}
          </text>
        );
      })}
    </svg>
  );
}

export function ScoreRing({ pct, threshold, size = 112 }: { pct: number; threshold?: number; size?: number }) {
  const C = 2 * Math.PI * 46;
  const dash = `${(Math.max(0, Math.min(100, pct)) / 100) * C} ${C}`;
  let tick: React.ReactNode = null;
  if (threshold !== undefined) {
    const a = -Math.PI / 2 + 2 * Math.PI * (threshold / 100);
    const x1 = 55 + 40 * Math.cos(a);
    const y1 = 55 + 40 * Math.sin(a);
    const x2 = 55 + 52 * Math.cos(a);
    const y2 = 55 + 52 * Math.sin(a);
    tick = <line x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: "var(--navy)", strokeWidth: 3, strokeLinecap: "round" }} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 110 110" role="img" aria-label={`Umumiy ball ${Math.round(pct)}%`}>
      <circle cx="55" cy="55" r="46" style={{ fill: "none", stroke: "var(--soft)", strokeWidth: 9 }} />
      <circle
        cx="55"
        cy="55"
        r="46"
        transform="rotate(-90 55 55)"
        strokeDasharray={dash}
        style={{ fill: "none", stroke: "var(--br)", strokeWidth: 9, strokeLinecap: "round" }}
      />
      {tick}
      <text
        x="55"
        y="63"
        textAnchor="middle"
        style={{ fill: "var(--tx)", fontSize: 24, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const pts = values
    .map((v, i) => `${(i * 80) / Math.max(1, values.length - 1)},${22 - (v * 20) / max}`)
    .join(" ");
  return (
    <svg viewBox="0 0 80 24" className="h-6 w-20" aria-hidden>
      <polyline points={pts} style={{ fill: "none", stroke: "var(--br)", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }} />
    </svg>
  );
}
