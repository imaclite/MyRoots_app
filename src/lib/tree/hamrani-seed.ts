import type { Person, TreeData } from "./types";

/**
 * بيانات أولية مأخوذة من مخطط "شجرة العائلة الحمراني" (القطعة الأولى، 1435هـ/2014م)
 * الذي رفعه المستخدم — فرع واحد فقط تم نسخه والتحقق منه حتى الآن (عبدالله بن
 * علي، 1900-1985، وذريته حتى الجيل الرابع). هذا يحل محل "أضف أول شخص" في أول
 * تشغيل فقط؛ إن عدّل المستخدم أي شيء تُحفظ نسخته هو تلقائيًا ولا تُستبدل مرة
 * أخرى (نفس آلية `createDemoTree`). بقية فروع المخطط (بوحمد، الجعفر، الموسى،
 * العمراني، ...) لم تُنسخ بعد وستُضاف لاحقًا.
 */

function p(partial: Partial<Person> & { id: string; givenName: string; gender: Person["gender"] }): Person {
  return {
    id: partial.id,
    givenName: partial.givenName,
    fatherName: partial.fatherName ?? "",
    grandfatherName: partial.grandfatherName ?? "",
    greatGrandfatherName: partial.greatGrandfatherName ?? "",
    kunya: partial.kunya ?? "",
    familyName: partial.familyName ?? "الحمراني",
    gender: partial.gender,
    birthDate: partial.birthDate ?? "",
    birthPlace: partial.birthPlace ?? "",
    deathDate: partial.deathDate ?? "",
    deathPlace: partial.deathPlace ?? "",
    deceased: partial.deceased ?? Boolean(partial.deathDate),
    residence: partial.residence ?? "",
    occupation: partial.occupation ?? "",
    notes: partial.notes ?? "",
    countryCode: partial.countryCode ?? "",
    photoId: null,
    photoScale: 1,
    photoSize: "md",
    photoX: 50,
    photoY: 50,
    burialPlace: "",
    burialGps: "",
    documents: [],
    fatherId: partial.fatherId ?? null,
    motherId: partial.motherId ?? null,
    spouseId: null,
    spouseIds: [],
    houseHead: partial.houseHead ?? false,
    wifeKind: partial.deathDate ? "deceased" : "current",
    birthOrder: partial.birthOrder ?? 0,
  };
}

export const HAMRANI_SEED_FOCUS_ID = "h-abdullah";

export function createHamraniSeedTree(): TreeData {
  const people: Record<string, Person> = {
    "h-ali": p({
      id: "h-ali",
      givenName: "علي",
      gender: "male",
      houseHead: true,
      notes: "زوجته (كما في المخطط): فاطمة أحمد الرشيد.",
    }),
    "h-abdullah": p({
      id: "h-abdullah",
      givenName: "عبدالله",
      gender: "male",
      fatherId: "h-ali",
      birthDate: "1900",
      deathDate: "1985",
      notes: "زوجتاه (كما في المخطط): عطية أحمد علي المويل، وفاطمة أحمد محمد العطية.",
    }),

    "h-fatima1": p({ id: "h-fatima1", givenName: "فاطمة", gender: "female", fatherId: "h-abdullah", notes: "زوجها (كما في المخطط): فاضل محمد صالح علي المويل." }),
    "h-ribab": p({ id: "h-ribab", givenName: "رباب", gender: "female", fatherId: "h-abdullah", notes: "ملاحظة مجاورة غير مؤكدة الربط: نرجس علي عبدالله محمد حسن بوحمد." }),
    "h-baqir": p({ id: "h-baqir", givenName: "باقر", gender: "male", fatherId: "h-abdullah" }),
    "h-sadiqa": p({ id: "h-sadiqa", givenName: "صديقة", gender: "female", fatherId: "h-abdullah", notes: "زوجها (كما في المخطط): علي عبدالله محمد الصعيليك." }),
    "h-mohammed": p({
      id: "h-mohammed",
      givenName: "محمد",
      gender: "male",
      fatherId: "h-abdullah",
      birthDate: "1933",
      deathDate: "2013",
      notes: "زوجته: بدرية أحمد حسن حسين الحواج.",
    }),

    "h-bushra": p({ id: "h-bushra", givenName: "بشرى", gender: "female", fatherId: "h-ribab", notes: "غير مؤكد تمامًا الربط بالأب — راجع المخطط الأصلي. ملاحظة مجاورة: محمد رجب صالح فتحي." }),
    "h-fatima-r": p({ id: "h-fatima-r", givenName: "فاطمة", gender: "female", fatherId: "h-ribab", notes: "غير مؤكد تمامًا الربط بالأب — راجع المخطط الأصلي. ملاحظة مجاورة: سعاد علي عبدالله البوزيد." }),

    "h-layla": p({ id: "h-layla", givenName: "ليلى", gender: "female", fatherId: "h-mohammed", notes: "زوجها: جمال معتوق أحمد حسن علي عبدالله الوايل." }),
    "h-shorouq": p({ id: "h-shorouq", givenName: "شروق", gender: "female", fatherId: "h-mohammed" }),
    "h-wafaa": p({ id: "h-wafaa", givenName: "وفاء", gender: "female", fatherId: "h-mohammed", notes: "زوجها: عباس محمد أحمد علي عبدالله الوايل." }),
    "h-fatima-m": p({ id: "h-fatima-m", givenName: "فاطمة", gender: "female", fatherId: "h-mohammed", notes: "زوجها: عدنان علي محمد حسن حسن بوحمد." }),
    "h-hanaa": p({ id: "h-hanaa", givenName: "هناء", gender: "female", fatherId: "h-mohammed", notes: "زوجها: عقيل سلمان أحمد حسن حسين الحواج." }),
    "h-hani": p({ id: "h-hani", givenName: "هاني", gender: "male", fatherId: "h-mohammed", notes: "زوجته: نجلاء حسن عبدالله حسن علي محمد بوحمد." }),
    "h-sadiq": p({ id: "h-sadiq", givenName: "صادق", gender: "male", fatherId: "h-mohammed", notes: "زوجته: أسماء علي أحمد محمد صالح الرمضان." }),
    "h-jasim": p({ id: "h-jasim", givenName: "جاسم", gender: "male", fatherId: "h-mohammed", notes: "زوجته: رنا عبدالرزاق عبدالله ملا يوسف بن عيد." }),

    "h-badria-h": p({ id: "h-badria-h", givenName: "بدرية", gender: "female", fatherId: "h-hani" }),
    "h-mohammed-h": p({ id: "h-mohammed-h", givenName: "محمد", gender: "male", fatherId: "h-hani" }),
    "h-ali-h": p({ id: "h-ali-h", givenName: "علي", gender: "male", fatherId: "h-hani" }),

    "h-ali-s": p({ id: "h-ali-s", givenName: "علي", gender: "male", fatherId: "h-sadiq" }),
    "h-mohammed-s": p({ id: "h-mohammed-s", givenName: "محمد", gender: "male", fatherId: "h-sadiq" }),

    "h-ali-j": p({ id: "h-ali-j", givenName: "علي", gender: "male", fatherId: "h-jasim", notes: "أمه: رنا عبدالرزاق عبدالله ملا يوسف بن عيد." }),
    "h-batool-j": p({ id: "h-batool-j", givenName: "بتول", gender: "female", fatherId: "h-jasim", notes: "أمها: رنا عبدالرزاق عبدالله ملا يوسف بن عيد." }),
    "h-mohammed-j": p({ id: "h-mohammed-j", givenName: "محمد", gender: "male", fatherId: "h-jasim", notes: "أمه: رنا عبدالرزاق عبدالله ملا يوسف بن عيد." }),
    "h-abdullah-j": p({ id: "h-abdullah-j", givenName: "عبدالله", gender: "male", fatherId: "h-jasim", notes: "أمه: رنا عبدالرزاق عبدالله ملا يوسف بن عيد." }),
  };

  return {
    version: 1,
    treeName: "شجرة الحمراني (فرع أولي — يحتاج استكمال)",
    people,
    focusId: HAMRANI_SEED_FOCUS_ID,
    updatedAt: new Date().toISOString(),
  };
}

export function isHamraniSeed(data: { people?: Record<string, Person> } | null | undefined): boolean {
  if (!data?.people) return false;
  const ids = Object.keys(data.people);
  const seedIds = Object.keys(createHamraniSeedTree().people);
  if (ids.length !== seedIds.length) return false;
  return seedIds.every((id) => id in data.people!);
}
