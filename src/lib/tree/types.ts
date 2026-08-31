export type Gender = "male" | "female" | "unknown";

export type WifeKind = "current" | "previous" | "deceased";

export type ViewMode = "tree" | "houses" | "fan";

export type PhotoSize = "sm" | "md" | "lg";

export const PHOTO_EDGE: Record<PhotoSize, number> = {
  sm: 480,
  md: 960,
  lg: 1600,
};

export function clampPos(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 50;
  return Math.min(100, Math.max(0, v));
}

export type DocumentKind = "birth" | "death" | "photo" | "grave" | "other";

export type PersonDocument = {
  id: string;
  kind: DocumentKind;
  name: string;
  mime: string;
  title?: string;
};

export type Person = {
  id: string;
  givenName: string;
  fatherName: string;
  familyName: string;
  gender: Gender;
  birthDate: string;
  birthPlace: string;
  deathDate: string;
  deathPlace: string;
  residence: string;
  occupation: string;
  notes: string;
  countryCode: string;
  photoId: string | null;
  photoScale: number;
  photoSize: PhotoSize;
  photoX: number;
  photoY: number;
  burialPlace: string;
  burialGps: string;
  documents: PersonDocument[];
  fatherId: string | null;
  motherId: string | null;
  spouseId: string | null;
  spouseIds: string[];
  houseHead: boolean;
  wifeKind: WifeKind;
};

export type TreeData = {
  version: 1;
  treeName: string;
  people: Record<string, Person>;
  focusId: string | null;
  updatedAt: string;
};

export type PersonDraft = {
  givenName: string;
  fatherName: string;
  familyName: string;
  gender: Gender;
  birthDate: string;
  birthPlace: string;
  deathDate: string;
  deathPlace: string;
  residence: string;
  occupation: string;
  notes: string;
  countryCode: string;
  burialPlace: string;
  burialGps: string;
  photoScale: number;
  photoSize: PhotoSize;
  photoX: number;
  photoY: number;
  houseHead: boolean;
  wifeKind: WifeKind;
};

export type SaveRecord = {
  id: string;
  filename: string;
  action: string;
  personName: string;
  createdAt: string;
  data: TreeData;
};

export type LayoutNode = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  role: "focus" | "spouse" | "child" | "ancestor" | "inlaw";
  caption?: string;
};

export type LayoutEdge = {
  id: string;
  points: { x: number; y: number }[];
  kind: "parent" | "spouse" | "child";
};

export type TreeLayout = {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  bbox: { x: number; y: number; w: number; h: number };
};

export const CARD_W = 252;
export const CARD_H = 96;
export const GAP_X = 78;
export const GAP_Y = 16;
export const SPOUSE_GAP = 24;
export const PAD = 80;

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export function spouseIdList(person: Pick<Person, "spouseId" | "spouseIds">): string[] {
  return uniqueIds([person.spouseId, ...(person.spouseIds ?? [])]);
}

export function normalizePerson(raw: Person): Person {
  const spouseIds = spouseIdList(raw);
  return {
    ...raw,
    countryCode:
      raw.countryCode ??
      (/(الكويت|Kuwait)/i.test(`${raw.birthPlace ?? ""}${raw.residence ?? ""}`) ? "KW" : ""),
    photoId: raw.photoId ?? null,
    photoScale: typeof raw.photoScale === "number" && raw.photoScale > 0 ? raw.photoScale : 1,
    photoSize: raw.photoSize === "sm" || raw.photoSize === "lg" ? raw.photoSize : "md",
    photoX: clampPos(raw.photoX),
    photoY: clampPos(raw.photoY),
    houseHead: Boolean(raw.houseHead),
    wifeKind:
      raw.deathDate || raw.wifeKind === "deceased"
        ? "deceased"
        : raw.wifeKind === "previous"
          ? "previous"
          : "current",
    gender: raw.gender === "female" || raw.gender === "unknown" ? raw.gender : "male",
    burialPlace: raw.burialPlace ?? "",
    burialGps: raw.burialGps ?? "",
    documents: Array.isArray(raw.documents)
      ? raw.documents.map((d) => ({
          ...d,
          title: (d.title || "").trim() || d.name,
        }))
      : [],
    spouseIds,
    spouseId: spouseIds[0] ?? null,
  };
}

export function normalizeTree(data: TreeData): TreeData {
  const people: Record<string, Person> = {};
  for (const [id, person] of Object.entries(data.people ?? {})) {
    people[id] = normalizePerson(person);
  }
  return { ...data, people };
}
