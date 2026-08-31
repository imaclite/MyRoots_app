import { create } from "zustand";
import { createDemoTree, isStockDemo } from "./demo-data";
import { createHamraniSeedTree } from "./hamrani-seed";
import { fullName } from "./format";
import { bindSpouseIds, canAddWife, spousesOf, unlinkPerson } from "./graph";
import { deleteMedia } from "./media";
import { toGedcom } from "./gedcom";
import {
  loadCurrent,
  loadSaves,
  onCrashSave,
  persistTree,
  gedcomFilename,
  rememberExplicitSave,
} from "./storage";
import { spouseIdList, type Person, type PersonDraft, type PersonDocument, type SaveRecord, type TreeData, type ViewMode } from "./types";

type Snapshot = TreeData;

export type DialogKind =
  | null
  | "add-child"
  | "add-son"
  | "add-daughter"
  | "add-spouse"
  | "add-father"
  | "add-mother"
  | "add-brother"
  | "add-sister"
  | "add-person"
  | "edit"
  | "first-person"
  | "confirm-new"
  | "confirm-delete"
  | "people"
  | "saves"
  | "details";

function isRepeatAddDialog(dialog: DialogKind): boolean {
  return dialog === "add-son" || dialog === "add-daughter" || dialog === "add-brother" || dialog === "add-sister" || dialog === "add-child";
}

type Store = {
  treeName: string;
  people: Record<string, Person>;
  focusId: string | null;
  selectedId: string | null;
  view: ViewMode;
  showDemoBanner: boolean;
  hydrated: boolean;
  dialog: DialogKind;
  dialogPersonId: string | null;
  fileId: string | null;
  saves: SaveRecord[];
  lastSaveName: string | null;
  dirty: boolean;
  past: Snapshot[];
  future: Snapshot[];
  hydrate: () => void;
  setView: (view: ViewMode) => void;
  setFocus: (id: string) => void;
  setSelected: (id: string | null) => void;
  openDialog: (kind: DialogKind, personId?: string | null) => void;
  closeDialog: () => void;
  openFile: (id: string) => void;
  closeFile: () => void;
  dismissBanner: () => void;
  setTreeName: (name: string) => void;
  addChild: (parentId: string, draft: PersonDraft, otherParentId: string | null) => string;
  linkExistingChild: (parentId: string, childId: string, otherParentId: string | null) => void;
  linkExistingSpouse: (personId: string, spouseId: string) => void;
  linkExistingParent: (childId: string, parentId: string, which: "father" | "mother") => void;
  addSpouse: (personId: string, draft: PersonDraft) => string;
  addParent: (childId: string, which: "father" | "mother", draft: PersonDraft) => string;
  addSibling: (personId: string, draft: PersonDraft) => string;
  linkExistingSibling: (personId: string, siblingId: string) => void;
  addUnlinked: (draft: PersonDraft) => string;
  updatePerson: (id: string, draft: PersonDraft) => void;
  setPhoto: (id: string, photoId: string | null) => void;
  addDocument: (id: string, doc: PersonDocument) => void;
  renameDocument: (id: string, docId: string, title: string) => void;
  removeDocument: (id: string, docId: string) => void;
  deleteSelected: () => void;
  newTree: () => void;
  resetDemo: () => void;
  importTree: (data: TreeData) => void;
  undo: () => void;
  redo: () => void;
  downloadTree: (filename?: string) => Promise<{ filename: string; mode: "picked" | "shared" | "download" | "cancel"; text: string }>;
  prepareSave: (filename?: string) => { filename: string; text: string };
  refreshSaves: () => void;
  restoreSave: (id: string) => void;
};

function snapshotOf(s: { treeName: string; people: Record<string, Person>; focusId: string | null }): Snapshot {
  return {
    version: 1,
    treeName: s.treeName,
    people: s.people,
    focusId: s.focusId,
    updatedAt: new Date().toISOString(),
  };
}

function emptyTree(): Snapshot {
  return {
    version: 1,
    treeName: "شجرة جديدة",
    people: {},
    focusId: null,
    updatedAt: new Date().toISOString(),
  };
}

function clonePeople(people: Record<string, Person>): Record<string, Person> {
  const next: Record<string, Person> = {};
  for (const [k, v] of Object.entries(people)) next[k] = { ...v };
  return next;
}

function fromDraft(id: string, draft: PersonDraft): Person {
  return {
    id,
    givenName: draft.givenName.trim(),
    fatherName: draft.fatherName.trim(),
    familyName: draft.familyName.trim(),
    gender: draft.gender,
    birthDate: draft.birthDate,
    birthPlace: draft.birthPlace.trim(),
    deathDate: draft.deathDate,
    deathPlace: draft.deathPlace.trim(),
    residence: draft.residence.trim(),
    occupation: draft.occupation.trim(),
    notes: draft.notes.trim(),
    countryCode: draft.countryCode,
    photoId: null,
    photoScale: draft.photoScale || 1,
    photoSize: draft.photoSize || "md",
    photoX: draft.photoX ?? 50,
    photoY: draft.photoY ?? 50,
    burialPlace: draft.burialPlace.trim(),
    burialGps: draft.burialGps.trim(),
    documents: [],
    fatherId: null,
    motherId: null,
    spouseId: null,
    spouseIds: [],
    houseHead: Boolean(draft.houseHead),
    wifeKind: draft.deathDate || draft.wifeKind === "deceased" ? "deceased" : draft.wifeKind === "previous" ? "previous" : "current",
  };
}

const demo = createDemoTree();

export const useTreeStore = create<Store>((set, get) => {
  const commit = (
    next: { people: Record<string, Person>; focusId: string | null; treeName?: string },
    action: string,
    personName: string,
  ) => {
    const curr = get();
    const past = [...curr.past, snapshotOf(curr)].slice(-40);
    const treeName = next.treeName ?? curr.treeName;
    const snap: Snapshot = {
      version: 1,
      treeName,
      people: next.people,
      focusId: next.focusId,
      updatedAt: new Date().toISOString(),
    };
    persistTree(snap);
    set({
      people: next.people,
      focusId: next.focusId,
      treeName,
      past,
      future: [],
      showDemoBanner: false,
      dirty: true,
    });
  };

  return {
    treeName: "شجرة جديدة",
    people: {},
    focusId: null,
    selectedId: null,
    view: "tree",
    showDemoBanner: false,
    hydrated: false,
    dialog: null,
    dialogPersonId: null,
    fileId: null,
    saves: [],
    lastSaveName: null,
    dirty: false,
    past: [],
    future: [],

    hydrate: () => {
      const saved = loadCurrent();
      const keep = Boolean(saved && Object.keys(saved.people).length > 0 && !isStockDemo(saved));
      if (get().hydrated && keep) return;
      let saves: ReturnType<typeof loadSaves> = [];
      try {
        saves = loadSaves();
      } catch {
        saves = [];
      }
      if (keep && saved) {
        set({
          treeName: saved.treeName,
          people: saved.people,
          focusId: saved.focusId,
          selectedId: saved.focusId,
          showDemoBanner: false,
          hydrated: true,
          saves,
          dirty: false,
          dialog: null,
        });
      } else {
        // أول تشغيل بلا بيانات محفوظة: نبدأ بفرع مبدئي من مخطط شجرة الحمراني
        // (بدل شجرة فارغة تجبر على "أضف أول شخص") — يحتاج مراجعة واستكمال.
        const seed = createHamraniSeedTree();
        persistTree(seed);
        set({
          treeName: seed.treeName,
          people: seed.people,
          focusId: seed.focusId,
          selectedId: seed.focusId,
          showDemoBanner: true,
          hydrated: true,
          saves,
          lastSaveName: null,
          dirty: false,
          dialog: null,
          dialogPersonId: null,
          fileId: null,
        });
      }
      onCrashSave(() => snapshotOf(get()));
    },

    setView: (view) => set({ view }),
    setFocus: (id) => set({ focusId: id, selectedId: id }),
    setSelected: (id) => set({ selectedId: id }),
    openFile: (id) => set({ fileId: id, selectedId: id }),
    closeFile: () => set({ fileId: null }),
    openDialog: (kind, personId = null) => {
      const id = personId ?? get().fileId ?? get().selectedId;
      if (kind === "details") {
        if (id) set({ fileId: id, selectedId: id, dialog: null, dialogPersonId: null });
        return;
      }
      set({ dialog: kind, dialogPersonId: id });
    },
    closeDialog: () => set({ dialog: null, dialogPersonId: null }),
    dismissBanner: () => set({ showDemoBanner: false }),
    setTreeName: (name) => {
      commit({ people: get().people, focusId: get().focusId, treeName: name }, "تعديل", name || "شجرة");
    },

    addChild: (parentId, draft, otherParentId) => {
      const { people } = get();
      const parent = people[parentId];
      if (!parent) return "";
      const id = crypto.randomUUID();
      const child = fromDraft(id, draft);
      if (parent.gender === "male") {
        child.fatherId = parent.id;
        child.motherId = otherParentId;
      } else {
        child.motherId = parent.id;
        child.fatherId = otherParentId;
      }
      const next = clonePeople(people);
      next[id] = child;
      commit({ people: next, focusId: get().focusId }, "إضافة", fullName(child) || child.givenName);
      if (!isRepeatAddDialog(get().dialog)) set({ selectedId: id });
      return id;
    },

    linkExistingChild: (parentId, childId, otherParentId) => {
      const { people } = get();
      const parent = people[parentId];
      const child = people[childId];
      if (!parent || !child || parentId === childId) return;
      const other = otherParentId ? people[otherParentId] : null;
      const next = clonePeople(people);
      if (parent.gender === "male") {
        next[childId] = {
          ...child,
          fatherId: parent.id,
          motherId: other?.id ?? child.motherId ?? spouseIdList(parent)[0] ?? null,
        };
      } else {
        next[childId] = {
          ...child,
          motherId: parent.id,
          fatherId: other?.id ?? child.fatherId ?? spouseIdList(parent)[0] ?? null,
        };
      }
      commit({ people: next, focusId: get().focusId }, "ربط", fullName(child));
      set({ selectedId: childId });
    },

    linkExistingSpouse: (personId, spouseId) => {
      const { people } = get();
      const person = people[personId];
      const spouse = people[spouseId];
      if (!person || !spouse || personId === spouseId) return;
      if (!canAddWife(person, spousesOf(people, person), "current")) return;
      const next = clonePeople(people);
      next[personId] = bindSpouseIds(person, spouseId);
      next[spouseId] = bindSpouseIds(spouse, personId);
      commit({ people: next, focusId: get().focusId }, "زوج", fullName(spouse));
    },

    linkExistingParent: (childId, parentId, which) => {
      const { people } = get();
      const child = people[childId];
      const parent = people[parentId];
      if (!child || !parent || childId === parentId) return;
      const next = clonePeople(people);
      next[childId] = {
        ...child,
        fatherId: which === "father" ? parentId : child.fatherId,
        motherId: which === "mother" ? parentId : child.motherId,
      };
      const otherId = which === "father" ? child.motherId : child.fatherId;
      if (otherId && next[otherId]) {
        next[parentId] = bindSpouseIds(parent, otherId);
        next[otherId] = bindSpouseIds(next[otherId]!, parentId);
      } else {
        next[parentId] = parent;
      }
      commit({ people: next, focusId: get().focusId }, which === "father" ? "والد" : "والدة", fullName(parent));
    },

    addSpouse: (personId, draft) => {
      const { people } = get();
      const person = people[personId];
      if (!person) return "";
      const kind =
        draft.deathDate || draft.wifeKind === "deceased"
          ? "deceased"
          : draft.wifeKind === "previous"
            ? "previous"
            : "current";
      if (!canAddWife(person, spousesOf(people, person), kind)) return "";
      const id = crypto.randomUUID();
      const spouse = fromDraft(id, draft);
      spouse.gender = person.gender === "male" ? "female" : "male";
      if (!draft.gender) {
        /* already set */
      }
      spouse.gender = draft.gender || spouse.gender;
      const next = clonePeople(people);
      next[id] = bindSpouseIds({ ...spouse, spouseId: personId, spouseIds: [personId] }, personId);
      next[personId] = bindSpouseIds(person, id);
      commit({ people: next, focusId: get().focusId }, "زوج", fullName(spouse) || spouse.givenName);
      set({ selectedId: id });
      return id;
    },

    addParent: (childId, which, draft) => {
      const { people } = get();
      const child = people[childId];
      if (!child) return "";
      const id = crypto.randomUUID();
      const parent = fromDraft(id, draft);
      parent.gender = which === "father" ? "male" : "female";
      const next = clonePeople(people);
      const otherId = which === "father" ? child.motherId : child.fatherId;
      if (otherId && next[otherId]) {
        parent.spouseIds = [otherId];
        parent.spouseId = otherId;
        next[otherId] = bindSpouseIds(next[otherId]!, id);
      }
      next[id] = parent;
      next[childId] = {
        ...next[childId]!,
        fatherId: which === "father" ? id : child.fatherId,
        motherId: which === "mother" ? id : child.motherId,
      };
      commit({ people: next, focusId: get().focusId }, which === "father" ? "والد" : "والدة", fullName(parent));
      set({ selectedId: id });
      return id;
    },

    addSibling: (personId, draft) => {
      const { people } = get();
      const person = people[personId];
      if (!person) return "";
      const id = crypto.randomUUID();
      const sibling = fromDraft(id, draft);
      sibling.fatherId = person.fatherId;
      sibling.motherId = person.motherId;
      if (!sibling.familyName) sibling.familyName = person.familyName;
      if (!sibling.fatherName) sibling.fatherName = person.fatherName;
      const next = clonePeople(people);
      next[id] = sibling;
      commit({ people: next, focusId: get().focusId }, sibling.gender === "female" ? "أخت" : "أخ", fullName(sibling));
      if (!isRepeatAddDialog(get().dialog)) set({ selectedId: id });
      return id;
    },

    linkExistingSibling: (personId, siblingId) => {
      const { people } = get();
      const person = people[personId];
      const sibling = people[siblingId];
      if (!person || !sibling || personId === siblingId) return;
      const next = clonePeople(people);
      next[siblingId] = {
        ...sibling,
        fatherId: person.fatherId ?? sibling.fatherId,
        motherId: person.motherId ?? sibling.motherId,
      };
      commit({ people: next, focusId: get().focusId }, "أخ", fullName(sibling));
    },

    addUnlinked: (draft) => {
      const id = crypto.randomUUID();
      const person = fromDraft(id, draft);
      const next = clonePeople(get().people);
      next[id] = person;
      const focusId = get().focusId ?? id;
      commit({ people: next, focusId }, "إضافة", fullName(person) || person.givenName);
      set({ selectedId: id, focusId });
      return id;
    },

    updatePerson: (id, draft) => {
      const { people } = get();
      const prev = people[id];
      if (!prev) return;
      const next = clonePeople(people);
      next[id] = {
        ...prev,
        givenName: draft.givenName.trim(),
        fatherName: draft.fatherName.trim(),
        familyName: draft.familyName.trim(),
        gender: draft.gender,
        birthDate: draft.birthDate,
        birthPlace: draft.birthPlace.trim(),
        deathDate: draft.deathDate,
        deathPlace: draft.deathPlace.trim(),
        residence: draft.residence.trim(),
        occupation: draft.occupation.trim(),
        notes: draft.notes.trim(),
        countryCode: draft.countryCode,
        burialPlace: draft.burialPlace.trim(),
        burialGps: draft.burialGps.trim(),
        photoScale: draft.photoScale || 1,
        photoSize: draft.photoSize || "md",
        photoX: draft.photoX ?? 50,
        photoY: draft.photoY ?? 50,
        houseHead: Boolean(draft.houseHead),
        wifeKind:
          draft.deathDate || draft.wifeKind === "deceased"
            ? "deceased"
            : draft.wifeKind === "previous"
              ? "previous"
              : "current",
      };
      commit({ people: next, focusId: get().focusId }, "تعديل", fullName(next[id]!));
    },

    setPhoto: (id, photoId) => {
      const { people } = get();
      const prev = people[id];
      if (!prev) return;
      const old = prev.photoId;
      const next = clonePeople(people);
      next[id] = { ...prev, photoId };
      commit({ people: next, focusId: get().focusId }, "تعديل", fullName(prev));
      if (old && old !== photoId) void deleteMedia(old);
    },

    addDocument: (id, doc) => {
      const { people } = get();
      const prev = people[id];
      if (!prev) return;
      const next = clonePeople(people);
      next[id] = { ...prev, documents: [...prev.documents, { ...doc, title: doc.title || doc.name }] };
      commit({ people: next, focusId: get().focusId }, "تعديل", fullName(prev));
    },

    renameDocument: (id, docId, title) => {
      const { people } = get();
      const prev = people[id];
      if (!prev) return;
      const label = title.trim();
      if (!label) return;
      const next = clonePeople(people);
      next[id] = {
        ...prev,
        documents: prev.documents.map((d) => (d.id === docId ? { ...d, title: label } : d)),
      };
      commit({ people: next, focusId: get().focusId }, "تعديل", fullName(prev));
    },

    removeDocument: (id, docId) => {
      const { people } = get();
      const prev = people[id];
      if (!prev) return;
      const next = clonePeople(people);
      next[id] = { ...prev, documents: prev.documents.filter((d) => d.id !== docId) };
      commit({ people: next, focusId: get().focusId }, "تعديل", fullName(prev));
      void deleteMedia(docId);
    },

    deleteSelected: () => {
      const { selectedId, people, focusId } = get();
      if (!selectedId || !people[selectedId]) return;
      const name = fullName(people[selectedId]!);
      const doomed = people[selectedId]!;
      const next = unlinkPerson(people, selectedId);
      const nextFocus = focusId === selectedId ? (Object.keys(next)[0] ?? null) : focusId;
      commit({ people: next, focusId: nextFocus }, "حذف", name);
      set({ selectedId: nextFocus, dialog: null, dialogPersonId: null, fileId: get().fileId === selectedId ? null : get().fileId });
      if (doomed.photoId) void deleteMedia(doomed.photoId);
      for (const doc of doomed.documents) void deleteMedia(doc.id);
    },

    newTree: () => {
      const empty: Snapshot = {
        version: 1,
        treeName: "شجرة جديدة",
        people: {},
        focusId: null,
        updatedAt: new Date().toISOString(),
      };
      const curr = get();
      const past = [...curr.past, snapshotOf(curr)].slice(-40);
      persistTree(empty);
      set({
        ...empty,
        selectedId: null,
        showDemoBanner: false,
        dialog: "first-person",
        dialogPersonId: null,
        past,
        future: [],
        dirty: false,
        lastSaveName: null,
      });
    },

    resetDemo: () => {
      const fresh = createDemoTree();
      persistTree(fresh);
      set({
        treeName: fresh.treeName,
        people: fresh.people,
        focusId: fresh.focusId,
        selectedId: fresh.focusId,
        showDemoBanner: true,
        dialog: null,
        past: [],
        future: [],
        dirty: false,
        lastSaveName: null,
      });
    },

    importTree: (data) => {
      const curr = get();
      const past = [...curr.past, snapshotOf(curr)].slice(-40);
      persistTree(data);
      set({
        treeName: data.treeName,
        people: data.people,
        focusId: data.focusId,
        selectedId: data.focusId,
        showDemoBanner: false,
        past,
        future: [],
        dialog: null,
        dirty: false,
      });
    },

    undo: () => {
      const { past, future } = get();
      if (!past.length) return;
      const prev = past[past.length - 1]!;
      const curr = snapshotOf(get());
      persistTree(prev);
      set({
        treeName: prev.treeName,
        people: prev.people,
        focusId: prev.focusId,
        selectedId: prev.focusId,
        past: past.slice(0, -1),
        future: [curr, ...future].slice(0, 40),
        dirty: true,
      });
    },

    redo: () => {
      const { past, future } = get();
      if (!future.length) return;
      const nxt = future[0]!;
      const curr = snapshotOf(get());
      persistTree(nxt);
      set({
        treeName: nxt.treeName,
        people: nxt.people,
        focusId: nxt.focusId,
        selectedId: nxt.focusId,
        past: [...past, curr].slice(-40),
        future: future.slice(1),
        dirty: true,
      });
    },

    refreshSaves: () => set({ saves: loadSaves() }),

    prepareSave: (filename) => {
      const snap = snapshotOf(get());
      persistTree(snap);
      const name = gedcomFilename(filename || `${get().treeName || "نسب-حالية"}.ged`);
      const text = toGedcom(snap, name);
      const record = rememberExplicitSave(snap, name);
      set({ lastSaveName: name, dirty: false, saves: [record, ...get().saves].slice(0, 40) });
      return { filename: name, text };
    },

    downloadTree: async (filename) => {
      return { ...get().prepareSave(filename), mode: "download" as const };
    },

    restoreSave: (id) => {
      const rec = get().saves.find((s) => s.id === id) ?? loadSaves().find((s) => s.id === id);
      if (!rec) return;
      get().importTree(rec.data);
    },
  };
});
