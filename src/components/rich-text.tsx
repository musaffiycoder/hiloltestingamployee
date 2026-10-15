// Savol matni uchun xavfsiz, kichik markdown: paragraf, ro'yxat, jadval, kod bloki, **qalin** va `kod`.
// HTML kiritilmaydi (dangerouslySetInnerHTML yo'q) — matn faqat React elementlariga aylantiriladi.
import { Fragment, type ReactNode } from "react";

type Block =
  | { kind: "p"; text: string }
  | { kind: "code"; lang: string; text: string }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "ul" | "ol"; items: string[] };

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "p", text: para.join("\n") });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```(\w*)/);
    if (fence) {
      flush();
      const body: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) body.push(lines[i]);
      out.push({ kind: "code", lang: fence[1], text: body.join("\n") });
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      flush();
      const head = cells(line);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]); i++) rows.push(cells(lines[i]));
      i--;
      out.push({ kind: "table", head, rows });
      continue;
    }
    const li = line.match(/^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/);
    if (li) {
      flush();
      const kind = li[1] ? "ul" : "ol";
      const prev = out[out.length - 1];
      if (prev && prev.kind === kind) prev.items.push(li[3]);
      else out.push({ kind, items: [li[3]] });
      continue;
    }
    if (!line.trim()) flush();
    else para.push(line);
  }
  flush();
  return out;
}

/** Inline: **qalin** va `kod`. */
function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : p.startsWith("`") && p.endsWith("`") && p.length > 2 ? (
      <code key={i} className="rounded bg-soft px-1 py-0.5 font-mono text-[0.9em]">
        {p.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

/** Matnda markdown bloklari (jadval, kod, ro'yxat yoki bir nechta paragraf) bormi. */
export const isRich = (src: string) => parseBlocks(src).some((b) => b.kind !== "p") || parseBlocks(src).length > 1;

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {parseBlocks(text).map((b, i) => {
        if (b.kind === "p")
          return (
            <p key={i} className="whitespace-pre-line">
              {inline(b.text)}
            </p>
          );
        if (b.kind === "code")
          return (
            <pre key={i} className="overflow-x-auto rounded-xl bg-soft p-3 font-mono text-[13px] leading-relaxed">
              <code>{b.text}</code>
            </pre>
          );
        if (b.kind === "table")
          return (
            <div key={i} className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full border-collapse text-[14px] tabular-nums">
                <thead className="bg-soft">
                  <tr>
                    {b.head.map((h, j) => (
                      <th key={j} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                        {inline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j} className="border-t border-line">
                      {r.map((c, k) => (
                        <td key={k} className={`px-3 py-2 align-top ${c.length <= 14 ? "whitespace-nowrap" : ""}`}>
                          {inline(c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        const List = b.kind === "ul" ? "ul" : "ol";
        return (
          <List key={i} className={`flex flex-col gap-1 pl-5 ${b.kind === "ul" ? "list-disc" : "list-decimal"}`}>
            {b.items.map((it, j) => (
              <li key={j}>{inline(it)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

/** Ro'yxat uchun qisqa ko'rinish: birinchi paragraf (jadval/kod belgilarisiz). */
export function stemPreview(src: string) {
  const first = parseBlocks(src).find((b) => b.kind === "p");
  return (first && first.kind === "p" ? first.text : src).replace(/\*\*|`/g, "").replace(/\s+/g, " ").trim();
}
