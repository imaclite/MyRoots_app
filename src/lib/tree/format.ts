import type { Person, PersonDraft } from "./types";

const EASTERN = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"] as const;

const MONTHS_AR = [
  "",
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
] as const;

export function easternDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => EASTERN[Number(d)] ?? d);
}

export function fullName(person: Pick<Person, "givenName" | "fatherName" | "familyName">): string {
  return [person.givenName, person.fatherName, person.familyName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

export function initials(person: Pick<Person, "givenName">): string {
  const first = person.givenName.trim().charAt(0);
  return first ? `${first}ا` : "؟";
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const yearOnly = /^(\d{4})$/.exec(iso);
  if (yearOnly) return easternDigits(yearOnly[1] ?? iso);

  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!full) return easternDigits(iso);

  const year = full[1] ?? "";
  const month = Number(full[2]);
  const day = Number(full[3]);
  if (month === 1 && day === 1) return easternDigits(year);

  const monthName = MONTHS_AR[month] ?? "";
  return easternDigits(`${day} ${monthName} ${year}`);
}

export function formatEvent(abbr: string, date: string, place: string): string {
  const d = formatDate(date);
  if (!d && !place) return "";
  if (d && place) return `${abbr} ${d} · ${place}`;
  if (d) return `${abbr} ${d}`;
  return `${abbr} ${place}`;
}

export function isDeceased(person: Pick<Person, "deathDate">): boolean {
  return Boolean(person.deathDate);
}

export function emptyDraft(overrides: Partial<PersonDraft> = {}): PersonDraft {
  return {
    givenName: "",
    fatherName: "",
    familyName: "",
    gender: "male",
    birthDate: "",
    birthPlace: "",
    deathDate: "",
    deathPlace: "",
    residence: "",
    occupation: "",
    notes: "",
    countryCode: "",
    burialPlace: "",
    burialGps: "",
    photoScale: 1,
    photoSize: "md",
    photoX: 50,
    photoY: 50,
    houseHead: false,
    wifeKind: "current",
    ...overrides,
  };
}

export function personToDraft(person: Person): PersonDraft {
  return {
    givenName: person.givenName,
    fatherName: person.fatherName,
    familyName: person.familyName,
    gender: person.gender,
    birthDate: person.birthDate,
    birthPlace: person.birthPlace,
    deathDate: person.deathDate,
    deathPlace: person.deathPlace,
    residence: person.residence,
    occupation: person.occupation,
    notes: person.notes,
    countryCode: person.countryCode ?? "",
    burialPlace: person.burialPlace ?? "",
    burialGps: person.burialGps ?? "",
    photoScale: person.photoScale || 1,
    photoSize: person.photoSize || "md",
    photoX: person.photoX ?? 50,
    photoY: person.photoY ?? 50,
    houseHead: Boolean(person.houseHead),
    wifeKind: person.deathDate ? "deceased" : person.wifeKind === "previous" ? "previous" : "current",
  };
}

export function inheritChildNames(
  parent: Person,
  otherParent: Person | null,
): Pick<PersonDraft, "fatherName" | "familyName"> {
  const father = parent.gender === "male" ? parent : otherParent;
  const source = father ?? parent;
  return {
    fatherName: source.givenName,
    familyName: source.familyName,
  };
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function stampNow(date = new Date()): { date: string; time: string } {
  return {
    date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    time: `${pad2(date.getHours())}-${pad2(date.getMinutes())}`,
  };
}

export function safeFilenamePart(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9_\-]/g, "")
    .slice(0, 48) || "شخص";
}

export function buildSaveFilename(action: string, personName: string, date = new Date()): string {
  const { date: d, time } = stampNow(date);
  return `${d}_${time}_${action}_${safeFilenamePart(personName)}.json`;
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const { date, time } = stampNow(d);
  return easternDigits(`${date} ${time.replace("-", ":")}`);
}
