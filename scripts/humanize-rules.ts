// Savol matnini insoniy qilish qoidalari: generator va «humanize» promptida bir xil ishlatiladi.
export const HUMANIZE_RULES = [
  "- **Ma'no va aniqlik birinchi o'rinda.** Uslubni soddalashtirish savolning mazmunini, shartini, raqamini yoki to'g'ri javobini o'zgartirmasin. O'qigan nomzod nima so'ralayotganini, qanday ma'lumot berilganini va nima qilishi kerakligini bir marta o'qib tushunsin; aniqlik uchun kerakli atama yoki tafsilotni olib tashlama.",
  "- **Nomzodga ichki ma'lumotni ochma.** Savol matnida «yashirin tuzoq», «tuzoq», daraja raqami («3-darajada»), kompetensiya kodi, «yo'riqnomaning N-bandiga ko'ra», «qizil bayroq» degan so'zlar bo'lmasin — nomzod yo'riqnomani va baholash tizimini ko'rmaydi. Tuzoqni faqat ma'lumot ichiga joyla, uni nomlama.",
  "- Ish joyidagi jonli o'zbek tili: qisqa va o'rta gaplar, oddiy fe'llar. «ushbu», «mazkur», «amalga oshirish», «ta'minlash», «bartaraf etish», «mavjud bo'lgan» kabi idoraviy so'zlarni ishlatma («shu», «qilish», «tuzatish» yetarli).",
  "- Inglizcha atama bir marta, kerak bo'lsa: «context switching (kontekst almashinuvi)» kabi qavsli tarjimani har gapda takrorlama; sohada odatda inglizcha aytiladigan so'zlar (Reels, sprint, API, crash-free) tarjimasiz qolsin.",
  "- KATTA HARF bilan urg'u berma («ANIQ 3 ta», «TO'G'RI»). «Uchtasini tanlang» deb oddiy yoz.",
  "- «» qo'shtirnoqni faqat nom, iqtibos va ekrandagi yozuv uchun ishlat; har ikkinchi so'zni qo'shtirnoqqa olma.",
  "- Savol boshlanishi xilma-xil bo'lsin: har savol «Siz …», «Quyida …», «Qanday yo'l tutasiz?» bilan boshlanmasin/tugamasin. Ba'zan hamkasb xabari, ba'zan jadval, ba'zan qisqa vaziyat bilan boshlan.",
  "- Variantlar odam og'zidan chiqqanday: birinchi shaxsda, aniq harakat bilan («Avval … qilaman, keyin …»), tushuntirish-izohsiz. Variant ichida «chunki bu eng to'g'ri yo'l» kabi o'zini oqlash bo'lmasin.",
  "- Ismlar, sanalar va raqamlar tabiiy: haqiqiy ish holatidagidek (har raqam yumaloq ham, haddan ortiq aniq ham emas).",
].join("\n");
