export type Country = { code: string; name: string };

export const COUNTRIES: Country[] = [
  { code: "KW", name: "الكويت" },
  { code: "SA", name: "السعودية" },
  { code: "AE", name: "الإمارات" },
  { code: "QA", name: "قطر" },
  { code: "BH", name: "البحرين" },
  { code: "OM", name: "عُمان" },
  { code: "IQ", name: "العراق" },
  { code: "IR", name: "إيران" },
  { code: "JO", name: "الأردن" },
  { code: "PS", name: "فلسطين" },
  { code: "LB", name: "لبنان" },
  { code: "SY", name: "سوريا" },
  { code: "YE", name: "اليمن" },
  { code: "EG", name: "مصر" },
  { code: "SD", name: "السودان" },
  { code: "LY", name: "ليبيا" },
  { code: "TN", name: "تونس" },
  { code: "DZ", name: "الجزائر" },
  { code: "MA", name: "المغرب" },
  { code: "MR", name: "موريتانيا" },
  { code: "SO", name: "الصومال" },
  { code: "DJ", name: "جيبوتي" },
  { code: "KM", name: "جزر القمر" },
  { code: "TR", name: "تركيا" },
  { code: "PK", name: "باكستان" },
  { code: "IN", name: "الهند" },
  { code: "BD", name: "بنغلاديش" },
  { code: "ID", name: "إندونيسيا" },
  { code: "MY", name: "ماليزيا" },
  { code: "PH", name: "الفلبين" },
  { code: "GB", name: "بريطانيا" },
  { code: "US", name: "الولايات المتحدة" },
  { code: "CA", name: "كندا" },
  { code: "FR", name: "فرنسا" },
  { code: "DE", name: "ألمانيا" },
  { code: "IT", name: "إيطاليا" },
  { code: "ES", name: "إسبانيا" },
  { code: "AU", name: "أستراليا" },
];

const NAME_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c.name]));

export function countryName(code: string): string {
  return NAME_BY_CODE.get(code.toUpperCase()) ?? code;
}

export function flagEmoji(code: string): string {
  const cc = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc].map((ch) => 127397 + ch.charCodeAt(0)));
}

export function mapsHref(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t) || t.startsWith("geo:")) return t;
  const coords = t.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (coords) return `https://www.google.com/maps?q=${coords[1]},${coords[2]}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}`;
}
