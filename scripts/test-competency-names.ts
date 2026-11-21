import assert from "node:assert/strict";
import { codeExpander, expandCodesDeep } from "../src/lib/competency-names";

const x = codeExpander([
  { code: "V1", name: "Qadriyatlar: halollik, maxfiylik va mas'uliyat" },
  { code: "S4", name: "Muddat va ustuvorliklarni boshqarish" },
  { code: "S3", name: "Muammoni tahlil qilish va yechim topish" },
  { code: "H1", name: "Backend arxitekturasi va sifatli kod yozish" },
  { code: "H2", name: "API, autentifikatsiya va integratsiyalar" },
]);

const V1 = "Qadriyatlar: halollik, maxfiylik va mas'uliyat";
assert.equal(x("V1 (KRITIK) 4/4, 5/5 to'g'ri"), `${V1} (V1, KRITIK) 4/4, 5/5 to'g'ri`);
assert.equal(x("S4 4/4, 3/3 to'g'ri"), "Muddat va ustuvorliklarni boshqarish (S4) 4/4, 3/3 to'g'ri");
assert.equal(x("V1 va S4 kuchli."), `${V1} (V1) va Muddat va ustuvorliklarni boshqarish (S4) kuchli.`);
// nom allaqachon bor — tegmaydi
assert.equal(x(`${V1} (V1) yuqori`), `${V1} (V1) yuqori`);
const H1 = "Backend arxitekturasi va sifatli kod yozish";
// kod ortidan qisqa nom — to'liq nom bilan almashadi, takrorlanmaydi
assert.equal(x("H1 Backend arxitekturasi — daraja 5"), `${H1} (H1) — daraja 5`);
assert.equal(x("H1 · Backend arxitekturasi va sifatli kod yozish: 5/4"), `${H1} (H1): 5/4`);
// kod oldida nom (qisman yoki to'liq) — tegilmaydi
assert.equal(x("Backend arxitekturasi (H1) kuchli"), "Backend arxitekturasi (H1) kuchli");
assert.equal(x(`${H1} H1`), `${H1} H1`);
// tasodifiy so'z mosligi nomni yashirmasin
assert.equal(x("Muammoni hal qilishda S3 past"), "Muammoni hal qilishda Muammoni tahlil qilish va yechim topish (S3) past");
// ro'yxat va qavs ichidagi nom
assert.equal(x("(H1, H2)"), `(${H1} (H1), API, autentifikatsiya va integratsiyalar (H2))`);
assert.equal(x("V1 (Qadriyatlar) yuqori"), `${V1} (V1) yuqori`);
assert.equal(x("S4/V1 = 3"), `Muddat va ustuvorliklarni boshqarish (S4)/${V1} (V1) = 3`);
// qavs ichidagi yolg'iz kod
assert.equal(x("kamchilik (S4) bor"), "kamchilik (Muddat va ustuvorliklarni boshqarish, S4) bor");
// boshqa so'z ichida emas; AWS S3 emas
assert.equal(x("HV12, S10, S4a"), "HV12, S10, S4a");
assert.equal(x("AWS S3 bucket"), "AWS S3 bucket");
// ro'yxatda yo'q kod tegilmaydi
assert.equal(x("H9 past"), "H9 past");
// chuqur yoyish, code maydoni tegilmaydi
const d = expandCodesDeep({ code: "V1", name: V1, analysis: "V1 2/4", list: ["S4 yaxshi"], n: 3 }, x);
assert.deepEqual(d, { code: "V1", name: V1, analysis: `${V1} (V1) 2/4`, list: ["Muddat va ustuvorliklarni boshqarish (S4) yaxshi"], n: 3 });
console.log("competency-names: OK");
