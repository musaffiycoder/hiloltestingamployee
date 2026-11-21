/**
 * Hisobot matnlaridagi kompetensiya kodlarini (S1, H3, V1 …) to'liq nomga yoyadi:
 * «V1 (KRITIK) 4/4» → «Qadriyatlar: halollik, maxfiylik va mas'uliyat (V1, KRITIK) 4/4».
 * Saqlangan matnni o'zgartirmaydi — faqat ko'rsatishda ishlatiladi, shuning uchun eski
 * AI tahlillari ham qayta yaratilmasdan to'g'ri chiqadi.
 */
export type CompName = { code: string; name: string };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const norm = (w: string) => w.toLowerCase().replace(/[ʻʼ`’‘]/g, "'").replace(/[^\p{L}\p{N}']/gu, "");

/**
 * Kod ortidan nomning boshlanishi kelsa («H1 Backend arxitekturasi —»), o'sha qismni qaytaradi
 * (u to'liq nom bilan almashtiriladi). Kamida birinchi so'z mos kelishi kerak.
 */
function trailingNamePrefix(rest: string, nameWords: string[]): string {
  const lead = rest.match(/^\s*(?:[·:—–-]\s*)?/u)![0];
  let pos = lead.length;
  let matched = 0;
  for (const w of nameWords) {
    const m = rest.slice(pos).match(/^\s*([^\s]+)/u);
    if (!m) break;
    // Qavs bilan boshlangan so'z («(Qadriyatlar)») bu yerda emas, qavs bo'limida ko'riladi.
    if (/^[^\p{L}\p{N}]/u.test(m[1])) break;
    const tok = norm(m[1]);
    if (!tok || tok !== w) break;
    // So'z ortidagi tinish belgisi («yozish:», «arxitekturasi,») matnda qoladi.
    const trail = m[1].match(/[^\p{L}\p{N}'ʻʼ`’‘]+$/u)?.[0].length ?? 0;
    pos += m[0].length - trail;
    matched++;
    if (trail) break;
  }
  // Birinchi so'z juda qisqa bo'lsa (masalan «va»), tasodifiy moslikka ishonmaymiz.
  if (matched === 0 || (matched === 1 && nameWords[0].length < 4)) return "";
  return rest.slice(0, pos);
}

/** Kod oldidagi matn nomning boshi bilan tugaydimi: «… Backend arxitekturasi (» + H1. */
function endsWithNamePrefix(before: string, nameWords: string[]): boolean {
  if (!/[\s(·:—–-]$/u.test(before)) return false;
  const tail = before.replace(/[\s(·:—–-]+$/u, "").split(/\s+/).map(norm).filter(Boolean);
  for (let k = Math.min(nameWords.length, tail.length); k >= 1; k--) {
    if (k === 1 && nameWords[0].length < 4) break;
    const seg = tail.slice(tail.length - k);
    if (seg.every((w, i) => w === nameWords[i])) return true;
  }
  return false;
}

export function codeExpander(comps: CompName[]): (text: string) => string {
  const info = new Map(
    comps
      .filter((c) => c.code && c.name)
      .map((c) => {
        const name = c.name.trim();
        const words = name.split(/\s+/).map(norm).filter(Boolean);
        return [c.code.toUpperCase(), { name, words, first: words[0] ?? "" }] as const;
      }),
  );
  if (info.size === 0) return (t) => t;
  const alt = [...info.keys()].sort((a, b) => b.length - a.length).map(esc).join("|");
  // Kod alohida so'z bo'lishi shart (masalan «HV12» yoki «S1a» ichida emas).
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])(${alt})(?![\\p{L}\\p{N}_])`, "gu");

  return (text) => {
    if (!text) return text;
    let out = "";
    let last = 0;
    for (const m of text.matchAll(re)) {
      const code = m[1];
      const start = m.index!;
      let end = start + code.length;
      const c = info.get(code.toUpperCase())!;
      const before = text.slice(Math.max(0, start - 160), start);
      // Kod emas, boshqa narsa: «AWS S3», «Amazon S3».
      if (/(aws|amazon)\s*$/i.test(before)) continue;
      // Nom (yoki uning boshi) kod oldida allaqachon yozilgan: «Backend arxitekturasi (H1)».
      if (endsWithNamePrefix(before, c.words)) continue;

      let replacement: string;
      const rest = text.slice(end);
      const prefix = trailingNamePrefix(rest, c.words);
      if (prefix) {
        // «H1 Backend arxitekturasi» → «Backend arxitekturasi va sifatli kod yozish (H1)»
        end += prefix.length;
        replacement = `${c.name} (${code})`;
      } else if (text[start - 1] === "(" && text[end] === ")") {
        // Qavs ichidagi yolg'iz kod: «(V1)» → «(Nom, V1)»
        replacement = `${c.name}, ${code}`;
      } else {
        const paren = rest.match(/^\s*\(([^()]{1,60})\)/u);
        if (paren) {
          const inner = paren[1].trim();
          end += paren[0].length;
          // «V1 (Qadriyatlar …)» — qavsda nom bor; «V1 (KRITIK)» — qo'shimcha belgi.
          const innerFirst = norm(inner.split(/\s+/)[0] ?? "");
          replacement = innerFirst && innerFirst === c.first ? `${c.name} (${code})` : `${c.name} (${code}, ${inner})`;
        } else {
          replacement = `${c.name} (${code})`;
        }
      }
      out += text.slice(last, start) + replacement;
      last = end;
    }
    return out + text.slice(last);
  };
}

/** Obyekt ichidagi barcha matnlarni yoyadi; `skipKeys` dagi maydonlar (masalan, `code`) tegilmaydi. */
export function expandCodesDeep<T>(value: T, expand: (t: string) => string, skipKeys: ReadonlySet<string> = new Set(["code"])): T {
  const walk = (v: unknown, key?: string): unknown => {
    if (typeof v === "string") return key && skipKeys.has(key) ? v : expand(v);
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === "object" && !(v instanceof Date)) {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x, k)]));
    }
    return v;
  };
  return walk(value) as T;
}
