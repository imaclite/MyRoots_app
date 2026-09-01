import { fullName } from "./format";
import { spouseIdList, type Person } from "./types";

export function peopleList(people: Record<string, Person>): Person[] {
  return Object.values(people);
}

export function childrenOf(people: Record<string, Person>, id: string): Person[] {
  return peopleList(people)
    .filter((p) => p.fatherId === id || p.motherId === id)
    .sort(byBirthThenName);
}

export function byBirthThenName(a: Person, b: Person): number {
  const da = a.birthDate || "9999";
  const db = b.birthDate || "9999";
  if (da !== db) return da.localeCompare(db);
  return a.givenName.localeCompare(b.givenName, "ar");
}

export function spousesOf(people: Record<string, Person>, person: Person): Person[] {
  const seen = new Set<string>();
  const out: Person[] = [];
  for (const id of spouseIdList(person)) {
    const p = people[id];
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

export function spouseOf(people: Record<string, Person>, person: Person): Person | null {
  return spousesOf(people, person)[0] ?? null;
}

export function bindSpouseIds(person: Person, otherId: string): Person {
  const spouseIds = spouseIdList({ ...person, spouseId: person.spouseId, spouseIds: [...spouseIdList(person), otherId] });
  return { ...person, spouseIds, spouseId: spouseIds[0] ?? null };
}

export function daughterName(person: Pick<Person, "givenName" | "fatherName" | "familyName" | "gender">): string {
  if (person.gender === "female" && person.fatherName.trim()) {
    return `${person.givenName} بنت ${person.fatherName}${person.familyName ? ` ${person.familyName}` : ""}`;
  }
  return fullName(person);
}

export const MAX_WIVES = 4;

const ORDINALS = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة"] as const;

export function wifeOrdinal(index: number): string {
  return ORDINALS[index] ?? `${index + 1}`;
}

export function wifeStatus(spouse: Person): "current" | "previous" | "deceased" {
  if (spouse.deathDate || spouse.wifeKind === "deceased") return "deceased";
  if (spouse.wifeKind === "previous") return "previous";
  return "current";
}

export function wifeStatusTag(spouse: Person): string {
  const status = wifeStatus(spouse);
  if (status === "deceased") return "متوفاة";
  if (status === "previous") return "سابقة";
  return "";
}

export function currentWifeCount(spouses: Person[]): number {
  return spouses.filter((s) => wifeStatus(s) === "current").length;
}

export function canAddWife(
  person: Person,
  spouses: Person[],
  kind: "current" | "previous" | "deceased" = "current",
): boolean {
  if (person.gender !== "male") return true;
  if (kind !== "current") return true;
  return currentWifeCount(spouses) < MAX_WIVES;
}

export function spouseRankLabel(spouse: Person, index: number): string {
  const who = daughterName(spouse);
  if (spouse.gender === "female") {
    const tag = wifeStatusTag(spouse);
    return tag ? `الزوجة ${wifeOrdinal(index)} (${tag}): ${who}` : `الزوجة ${wifeOrdinal(index)}: ${who}`;
  }
  return `الزوج: ${who}`;
}

export function nextSpouseTitle(person: Person, existingCount: number, kind: "current" | "previous" | "deceased" = "current"): string {
  if (person.gender === "male") {
    if (kind === "previous") return "إضافة زوجة سابقة";
    if (kind === "deceased") return "إضافة زوجة سابقة متوفاة";
    return `إضافة الزوجة ${wifeOrdinal(existingCount)}`;
  }
  return existingCount ? "إضافة زوج آخر" : "إضافة زوج";
}

export function coupleChildren(people: Record<string, Person>, a: string, b: string | null): Person[] {
  return peopleList(people)
    .filter((p) => {
      const parents = [p.fatherId, p.motherId];
      if (parents.includes(a) && (!b || parents.includes(b))) return true;
      if (parents.includes(a) && !b) return true;
      return false;
    })
    .filter((p) => {
      if (!b) return p.fatherId === a || p.motherId === a;
      return (p.fatherId === a || p.motherId === a) && (p.fatherId === b || p.motherId === b);
    })
    .sort(byBirthThenName);
}

export function directChildrenOfCouple(
  people: Record<string, Person>,
  personId: string,
  spouseId: string | null,
): Person[] {
  const kids = childrenOf(people, personId);
  if (!spouseId) return kids;
  const both = kids.filter((k) => k.fatherId === spouseId || k.motherId === spouseId);
  return both.length ? both : kids;
}

export function childrenGroupedByOtherParent(
  people: Record<string, Person>,
  person: Person,
): { other: Person | null; label: string; children: Person[]; rank: number }[] {
  const kids = childrenOf(people, person.id);
  const spouses = spousesOf(people, person);
  const groups: { other: Person | null; label: string; children: Person[]; rank: number }[] = [];
  const used = new Set<string>();

  spouses.forEach((spouse, index) => {
    const list = kids.filter((k) => k.fatherId === spouse.id || k.motherId === spouse.id);
    list.forEach((k) => used.add(k.id));
    if (!list.length) return;
    groups.push({
      other: spouse,
      label: daughterName(spouse),
      children: list,
      rank: index,
    });
  });

  const unknown = kids.filter((k) => !used.has(k.id));
  if (unknown.length) {
    groups.push({ other: null, label: "من غير زوج مسجّل", children: unknown, rank: spouses.length });
  }
  return groups;
}

export function ancestorsOf(
  people: Record<string, Person>,
  id: string | null,
  gen: number,
  maxGen: number,
  out: Map<number, Person[]>,
  seen: Set<string>,
): void {
  if (!id || gen > maxGen) return;
  const person = people[id];
  if (!person || seen.has(id)) return;
  seen.add(id);
  const bucket = out.get(gen) ?? [];
  bucket.push(person);
  out.set(gen, bucket);
  ancestorsOf(people, person.fatherId, gen + 1, maxGen, out, seen);
  ancestorsOf(people, person.motherId, gen + 1, maxGen, out, seen);
}

export function ahnentafel(
  people: Record<string, Person>,
  focusId: string,
  maxGen: number,
): Map<number, Person | null> {
  const map = new Map<number, Person | null>();
  const focus = people[focusId];
  if (!focus) return map;
  map.set(1, focus);
  const walk = (n: number, id: string | null, gen: number) => {
    if (gen > maxGen) return;
    const person = id ? (people[id] ?? null) : null;
    map.set(n, person);
    if (!person) return;
    walk(n * 2, person.fatherId, gen + 1);
    walk(n * 2 + 1, person.motherId, gen + 1);
  };
  walk(2, focus.fatherId, 1);
  walk(3, focus.motherId, 1);
  return map;
}

export type House = {
  id: string;
  husband: Person | null;
  wife: Person | null;
  children: Person[];
};

export function housesOf(people: Record<string, Person>): House[] {
  const seen = new Set<string>();
  const houses: House[] = [];

  for (const person of peopleList(people)) {
    for (const b of spouseIdList(person)) {
      const a = person.id;
      const key = [a, b].sort().join("::");
      if (seen.has(key)) continue;
      seen.add(key);
      const pa = people[a]!;
      const pb = people[b];
      const husband = pa.gender === "male" ? pa : pb?.gender === "male" ? pb : pa;
      const wife = husband.id === pa.id ? (pb ?? null) : pa.gender === "female" ? pa : (pb ?? null);
      const hid = husband.id;
      const wid = wife?.id ?? null;
      const children = peopleList(people)
        .filter((c) => {
          if (!wid) return c.fatherId === hid || c.motherId === hid;
          return (
            (c.fatherId === hid && c.motherId === wid) ||
            (c.fatherId === wid && c.motherId === hid)
          );
        })
        .sort(byBirthThenName);
      houses.push({ id: key, husband, wife, children });
    }
  }

  houses.sort((a, b) => {
    const da = a.husband?.birthDate || a.wife?.birthDate || "9999";
    const db = b.husband?.birthDate || b.wife?.birthDate || "9999";
    return da.localeCompare(db);
  });
  return houses;
}

export function generationSpan(people: Record<string, Person>, focusId: string | null): number {
  if (!focusId || !people[focusId]) return 0;
  let maxUp = 0;
  const up = (id: string | null, g: number, seen: Set<string>) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    maxUp = Math.max(maxUp, g);
    const p = people[id];
    if (!p) return;
    up(p.fatherId, g + 1, seen);
    up(p.motherId, g + 1, seen);
  };
  let maxDown = 0;
  const down = (id: string, g: number, seen: Set<string>) => {
    if (seen.has(id)) return;
    seen.add(id);
    maxDown = Math.max(maxDown, g);
    for (const child of childrenOf(people, id)) down(child.id, g + 1, seen);
  };
  up(focusId, 0, new Set());
  down(focusId, 0, new Set());
  return maxUp + maxDown + 1;
}

export function unlinkPerson(people: Record<string, Person>, id: string): Record<string, Person> {
  const next: Record<string, Person> = {};
  for (const [key, person] of Object.entries(people)) {
    if (key === id) continue;
    const spouseIds = spouseIdList(person).filter((sid) => sid !== id);
    next[key] = {
      ...person,
      fatherId: person.fatherId === id ? null : person.fatherId,
      motherId: person.motherId === id ? null : person.motherId,
      spouseIds,
      spouseId: spouseIds[0] ?? null,
    };
  }
  return next;
}

export function similarPeople(
  people: Record<string, Person>,
  draft: { givenName: string; fatherName: string; familyName: string },
  excludeId?: string | null,
): Person[] {
  const g = draft.givenName.trim();
  if (g.length < 2) return [];
  const father = draft.fatherName.trim();
  const family = draft.familyName.trim();
  return peopleList(people)
    .filter((p) => p.id !== excludeId)
    .map((p) => {
      let score = 0;
      if (p.givenName === g) score += 4;
      else if (p.givenName.startsWith(g) || g.startsWith(p.givenName)) score += 2;
      else if (p.givenName.includes(g)) score += 1;
      else return { p, score: 0 };
      if (father && p.fatherName === father) score += 3;
      else if (father && (p.fatherName.includes(father) || father.includes(p.fatherName))) score += 1;
      if (family && p.familyName === family) score += 2;
      return { p, score };
    })
    .filter((row) => row.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((row) => row.p);
}

export function hasAncestor(people: Record<string, Person>, personId: string, ancestorId: string): boolean {
  const visited = new Set<string>();
  const queue = [personId];
  let guard = 0;
  while (queue.length && guard < 5000) {
    guard++;
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const p = people[id];
    if (!p) continue;
    if (p.fatherId === ancestorId || p.motherId === ancestorId) return true;
    if (p.fatherId) queue.push(p.fatherId);
    if (p.motherId) queue.push(p.motherId);
  }
  return false;
}

// يمنع إنشاء حلقة نسب مستحيلة (مثال: ربط حفيد كوالد لجدّه) عند ربط شخص موجود
// كأب/أم/ابن لشخص آخر — يُستخدم في السحب والإفلات وفي بحث "ربط شخص موجود".
export function wouldCreateCycle(people: Record<string, Person>, childId: string, newParentId: string): boolean {
  if (childId === newParentId) return true;
  return hasAncestor(people, newParentId, childId);
}

// بحث نصي بسيط (يشمل الاسم واسم الأب والعائلة) لإيجاد شخص موجود بالفعل في
// الشجرة لربطه، بدل إضافته من جديد مكررًا. مستقل عن similarPeople (التي تعمل
// فقط أثناء تعبئة نموذج شخص جديد وتتطلب تطابقًا قويًا في الاسم).
export function searchPeopleByName(people: Record<string, Person>, query: string, excludeId?: string | null): Person[] {
  const q = query.trim();
  if (q.length < 2) return [];
  return peopleList(people)
    .filter((p) => p.id !== excludeId)
    .filter((p) => `${p.givenName} ${p.fatherName} ${p.familyName} ${fullName(p)}`.includes(q))
    .sort((a, b) => a.givenName.localeCompare(b.givenName, "ar"))
    .slice(0, 8);
}

export function lineageHint(people: Record<string, Person>, person: Person): string {
  const father = person.fatherId ? people[person.fatherId] : null;
  const mother = person.motherId ? people[person.motherId] : null;
  const fatherBit = father ? `والده ${father.givenName}` : person.fatherName ? `والده ${person.fatherName}` : "";
  const motherBit = mother
    ? `والدته ${daughterName(mother)}`
    : "";
  return [fullName(person), [fatherBit, motherBit].filter(Boolean).join(" · ")].filter(Boolean).join(" — ");
}
