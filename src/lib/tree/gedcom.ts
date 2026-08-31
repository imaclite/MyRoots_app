import { spouseIdList, normalizeTree, type Person, type TreeData } from "./types";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

function westernDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function toGedcomDate(raw: string): string {
  const v = westernDigits(raw).trim();
  if (!v) return "";
  const yearOnly = /^(\d{4})$/.exec(v);
  if (yearOnly) return yearOnly[1] ?? "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!iso) return v;
  const month = MONTHS[Number(iso[2]) - 1];
  if (!month) return iso[1] ?? v;
  return `${Number(iso[3])} ${month} ${iso[1]}`;
}

export function fromGedcomDate(raw: string): string {
  const v = westernDigits(raw).replace(/^ABT\s+|^EST\s+|^CAL\s+/i, "").trim();
  if (!v) return "";
  const yearOnly = /^(\d{4})$/.exec(v);
  if (yearOnly) return yearOnly[1] ?? "";
  const full = /^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/i.exec(v);
  if (full) {
    const mi = MONTHS.indexOf(full[2]!.toUpperCase() as (typeof MONTHS)[number]);
    if (mi >= 0) return `${full[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(full[1])).padStart(2, "0")}`;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) return v;
  return v;
}

function push(lines: string[], level: number, tag: string, value = ""): void {
  const body = value ? `${tag} ${value}` : tag;
  const max = 240;
  if (body.length <= max) {
    lines.push(`${level} ${body}`);
    return;
  }
  lines.push(`${level} ${tag} ${value.slice(0, max - tag.length - 1)}`);
  let rest = value.slice(max - tag.length - 1);
  while (rest.length) {
    lines.push(`${level + 1} CONC ${rest.slice(0, 240)}`);
    rest = rest.slice(240);
  }
}

function indiName(p: Person): string {
  const given = [p.givenName, p.fatherName].map((s) => s.trim()).filter(Boolean).join(" ");
  const fam = p.familyName.trim();
  return fam ? `${given} /${fam}/` : given || "Unknown";
}

function gedcomNow(): string {
  const d = new Date();
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function parseGps(raw: string): { lati: string; long: string } | null {
  const m = /(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/.exec(raw);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    lati: `${lat >= 0 ? "N" : "S"}${Math.abs(lat)}`,
    long: `${lon >= 0 ? "E" : "W"}${Math.abs(lon)}`,
  };
}

export function toGedcom(data: TreeData, filename = "nasab.ged"): string {
  const people = Object.values(data.people);
  const idMap = new Map<string, string>();
  people.forEach((p, i) => idMap.set(p.id, `I${i + 1}`));
  const xref = (id: string) => `@${idMap.get(id) ?? id}@`;
  const fileLabel = filename.replace(/\.json$/i, "").replace(/[<>:"/\\|?*]/g, "-");
  const gedName = /\.ged$/i.test(fileLabel) ? fileLabel : `${fileLabel}.ged`;

  type Fam = { id: string; husb: string | null; wife: string | null; children: string[]; previous: boolean };
  const fams: Fam[] = [];
  const famIndex = new Map<string, Fam>();

  const pair = (husb: string | null, wife: string | null) => {
    const key = `${husb ?? ""}::${wife ?? ""}`;
    let fam = famIndex.get(key);
    if (!fam) {
      fam = { id: `F${fams.length + 1}`, husb, wife, children: [], previous: false };
      famIndex.set(key, fam);
      fams.push(fam);
    }
    return fam;
  };

  for (const p of people) {
    if (p.gender !== "male") continue;
    for (const sid of spouseIdList(p)) {
      const s = data.people[sid];
      if (!s) continue;
      const fam = pair(p.id, s.gender === "female" ? s.id : sid);
      if (s.wifeKind === "previous") fam.previous = true;
    }
  }

  for (const person of people) {
    if (!person.fatherId && !person.motherId) continue;
    pair(person.fatherId, person.motherId).children.push(person.id);
  }

  const lines: string[] = [];
  push(lines, 0, "HEAD");
  push(lines, 1, "GEDC");
  push(lines, 2, "VERS", "5.5.1");
  push(lines, 2, "FORM", "LINEAGE-LINKED");
  push(lines, 1, "CHAR", "UTF-8");
  push(lines, 1, "LANG", "Arabic");
  push(lines, 1, "SOUR", "Nasab");
  push(lines, 2, "NAME", "نسب");
  push(lines, 2, "VERS", "1.0");
  push(lines, 1, "DEST", "ANY");
  push(lines, 1, "DATE", gedcomNow());
  push(lines, 1, "FILE", gedName);
  push(lines, 1, "SUBM", "@SUB1@");
  push(lines, 1, "NOTE", `شجرة ${data.treeName}${data.focusId && idMap.has(data.focusId) ? ` | FOCUS:${idMap.get(data.focusId)}` : ""}`);

  push(lines, 0, "@SUB1@ SUBM");
  push(lines, 1, "NAME", "نسب");
  push(lines, 1, "LANG", "Arabic");

  for (const p of people) {
    const iid = idMap.get(p.id)!;
    const given = [p.givenName, p.fatherName].map((s) => s.trim()).filter(Boolean).join(" ");
    push(lines, 0, `@${iid}@ INDI`);
    push(lines, 1, "NAME", indiName(p));
    if (given) push(lines, 2, "GIVN", given);
    if (p.familyName.trim()) push(lines, 2, "SURN", p.familyName.trim());
    push(lines, 1, "SEX", p.gender === "female" ? "F" : "M");
    push(lines, 1, "REFN", p.id);
    if (p.birthDate || p.birthPlace) {
      push(lines, 1, "BIRT");
      if (p.birthDate) push(lines, 2, "DATE", toGedcomDate(p.birthDate));
      if (p.birthPlace) push(lines, 2, "PLAC", p.birthPlace);
    }
    if (p.deathDate || p.deathPlace) {
      push(lines, 1, "DEAT");
      if (p.deathDate) push(lines, 2, "DATE", toGedcomDate(p.deathDate));
      if (p.deathPlace) push(lines, 2, "PLAC", p.deathPlace);
    }
    if (p.burialPlace || p.burialGps) {
      push(lines, 1, "BURI");
      if (p.burialPlace) push(lines, 2, "PLAC", p.burialPlace);
      const gps = parseGps(p.burialGps);
      if (gps) {
        push(lines, 2, "MAP");
        push(lines, 3, "LATI", gps.lati);
        push(lines, 3, "LONG", gps.long);
      } else if (p.burialGps) {
        push(lines, 2, "NOTE", p.burialGps);
      }
    }
    if (p.occupation) push(lines, 1, "OCCU", p.occupation);
    if (p.residence) {
      push(lines, 1, "RESI");
      push(lines, 2, "PLAC", p.residence);
    }
    if (p.countryCode) push(lines, 1, "NATI", p.countryCode);
    const notes = [p.notes, p.houseHead ? "رب أسرة / بيت" : "", p.wifeKind === "previous" ? "زوجة سابقة" : ""]
      .filter(Boolean)
      .join(" | ");
    if (notes) push(lines, 1, "NOTE", notes);
    for (const fam of fams) {
      if (fam.husb === p.id || fam.wife === p.id) push(lines, 1, "FAMS", `@${fam.id}@`);
      if (fam.children.includes(p.id)) push(lines, 1, "FAMC", `@${fam.id}@`);
    }
  }

  for (const fam of fams) {
    if (!fam.husb && !fam.wife && !fam.children.length) continue;
    push(lines, 0, `@${fam.id}@ FAM`);
    if (fam.husb) push(lines, 1, "HUSB", xref(fam.husb));
    if (fam.wife) push(lines, 1, "WIFE", xref(fam.wife));
    if (fam.husb && fam.wife) {
      push(lines, 1, "MARR");
      if (fam.previous) push(lines, 1, "DIV", "Y");
    }
    if (fam.children.length) push(lines, 1, "NCHI", String(fam.children.length));
    for (const cid of fam.children) push(lines, 1, "CHIL", xref(cid));
  }

  push(lines, 0, "TRLR");
  return `${lines.join("\r\n")}\r\n`;
}

type Node = { tag: string; xref: string | null; value: string; kids: Node[] };

function parseNodes(text: string): Node[] {
  const roots: Node[] = [];
  const stack: Node[] = [];
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").split("\n");
  for (const line of raw) {
    const m = /^(\d+)\s+(?:@([^@]+)@\s+)?([A-Za-z0-9_]+)(?:\s+(.*))?$/.exec(line.trimEnd());
    if (!m) continue;
    const level = Number(m[1]);
    const node: Node = { tag: m[3]!.toUpperCase(), xref: m[2] ?? null, value: (m[4] ?? "").trim(), kids: [] };
    if (node.tag === "CONC" && stack.length) {
      stack[stack.length - 1]!.value += node.value;
      continue;
    }
    if (node.tag === "CONT" && stack.length) {
      stack[stack.length - 1]!.value += `\n${node.value}`;
      continue;
    }
    while (stack.length > level) stack.pop();
    if (level === 0) {
      roots.push(node);
      stack.length = 0;
      stack.push(node);
    } else if (stack.length) {
      stack[stack.length - 1]!.kids.push(node);
      stack.push(node);
    }
  }
  return roots;
}

function child(node: Node, tag: string): Node | undefined {
  return node.kids.find((k) => k.tag === tag);
}

function childVal(node: Node, tag: string): string {
  return child(node, tag)?.value ?? "";
}

function parseName(value: string): { givenName: string; fatherName: string; familyName: string } {
  const slash = /^(.*?)\/([^/]*)\/\s*(.*)$/.exec(value);
  const before = (slash ? slash[1]! : value).trim().split(/\s+/).filter(Boolean);
  return {
    givenName: before[0] ?? "",
    fatherName: before.slice(1).join(" "),
    familyName: (slash ? slash[2] : before.slice(2).join(" ")).trim(),
  };
}

function blankPerson(id: string): Person {
  return {
    id,
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
    photoId: null,
    photoScale: 1,
    photoSize: "md",
    photoX: 50,
    photoY: 50,
    burialPlace: "",
    burialGps: "",
    documents: [],
    fatherId: null,
    motherId: null,
    spouseId: null,
    spouseIds: [],
    houseHead: false,
    wifeKind: "current",
  };
}

export function fromGedcom(text: string): TreeData {
  const roots = parseNodes(text);
  const people: Record<string, Person> = {};
  const xrefToId = new Map<string, string>();
  let treeName = "شجرة";
  let focusXref: string | null = null;

  const head = roots.find((r) => r.tag === "HEAD");
  if (head) {
    const note = childVal(head, "NOTE");
    const named = /شجرة\s+([^|]+)/.exec(note);
    if (named) treeName = named[1]!.trim();
    const file = childVal(head, "FILE").replace(/\.ged$/i, "");
    if (!named && file) treeName = file;
    const focus = /FOCUS:([A-Za-z0-9]+)/.exec(note);
    focusXref = focus?.[1] ?? (childVal(head, "_FOCUS") || null);
  }

  for (const rec of roots) {
    if (rec.tag !== "INDI") continue;
    const xref = rec.xref;
    if (!xref) continue;
    const refn = childVal(rec, "REFN");
    const id = refn && refn.length > 8 ? refn : crypto.randomUUID();
    xrefToId.set(xref, id);
    const names = parseName(childVal(rec, "NAME"));
    const nameNode = child(rec, "NAME");
    if (nameNode) {
      const givn = childVal(nameNode, "GIVN").trim();
      const surn = childVal(nameNode, "SURN").trim();
      if (givn) {
        const parts = givn.split(/\s+/).filter(Boolean);
        names.givenName = parts[0] ?? names.givenName;
        names.fatherName = parts.slice(1).join(" ");
      }
      if (surn) names.familyName = surn;
    }
    const sex = childVal(rec, "SEX").toUpperCase();
    const birt = child(rec, "BIRT");
    const deat = child(rec, "DEAT");
    const buri = child(rec, "BURI");
    const resi = child(rec, "RESI");
    const wifeKindRaw = childVal(rec, "_WIFEKIND");
    const person = blankPerson(id);
    person.givenName = names.givenName;
    person.fatherName = names.fatherName;
    person.familyName = names.familyName;
    person.gender = sex === "F" ? "female" : "male";
    if (birt) {
      person.birthDate = fromGedcomDate(childVal(birt, "DATE"));
      person.birthPlace = childVal(birt, "PLAC");
    }
    if (deat) {
      person.deathDate = fromGedcomDate(childVal(deat, "DATE"));
      person.deathPlace = childVal(deat, "PLAC");
    }
    if (buri) {
      person.burialPlace = childVal(buri, "PLAC");
      person.burialGps = childVal(buri, "NOTE");
    }
    person.occupation = childVal(rec, "OCCU");
    person.residence = resi ? childVal(resi, "PLAC") : "";
    person.countryCode = childVal(rec, "NATI");
    person.notes = childVal(rec, "NOTE");
    person.houseHead = childVal(rec, "_HOUSE") === "Y";
    person.wifeKind = wifeKindRaw === "previous" || wifeKindRaw === "deceased" ? wifeKindRaw : "current";
    people[id] = person;
  }

  for (const rec of roots) {
    if (rec.tag !== "FAM") continue;
    const husbX = childVal(rec, "HUSB").replace(/@/g, "");
    const wifeX = childVal(rec, "WIFE").replace(/@/g, "");
    const husb = husbX ? xrefToId.get(husbX) : null;
    const wife = wifeX ? xrefToId.get(wifeX) : null;
    const divorced = Boolean(child(rec, "DIV"));
    if (husb && wife && people[husb] && people[wife]) {
      const h = people[husb]!;
      const w = people[wife]!;
      people[husb] = { ...h, spouseIds: spouseIdList({ ...h, spouseIds: [...spouseIdList(h), wife] }) };
      people[wife] = {
        ...w,
        spouseIds: spouseIdList({ ...w, spouseIds: [...spouseIdList(w), husb] }),
        wifeKind: divorced ? "previous" : w.wifeKind,
      };
    }
    for (const kid of rec.kids.filter((k) => k.tag === "CHIL")) {
      const cid = xrefToId.get(kid.value.replace(/@/g, ""));
      if (!cid || !people[cid]) continue;
      people[cid] = {
        ...people[cid]!,
        fatherId: husb ?? people[cid]!.fatherId,
        motherId: wife ?? people[cid]!.motherId,
      };
    }
  }

  const focusId =
    (focusXref && xrefToId.get(focusXref)) ||
    Object.values(people).find((p) => p.houseHead)?.id ||
    Object.keys(people)[0] ||
    null;

  return normalizeTree({
    version: 1,
    treeName,
    people,
    focusId,
    updatedAt: new Date().toISOString(),
  });
}

export function looksLikeGedcom(text: string): boolean {
  const head = text.slice(0, 200).replace(/^\uFEFF/, "");
  return /0\s+HEAD/.test(head);
}
