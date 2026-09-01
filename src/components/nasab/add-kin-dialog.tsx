import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/tree/copy";
import { emptyDraft, fullName, inheritChildNames } from "@/lib/tree/format";
import {
  canAddWife,
  currentWifeCount,
  lineageHint,
  nextSpouseTitle,
  searchPeopleByName,
  spouseRankLabel,
  spousesOf,
  wifeOrdinal,
} from "@/lib/tree/graph";
import { compressImage, putMedia } from "@/lib/tree/media";
import { useTreeStore } from "@/lib/tree/store";
import type { DialogKind } from "@/lib/tree/store";
import type { Gender, Person, PersonDraft } from "@/lib/tree/types";
import { PHOTO_EDGE } from "@/lib/tree/types";
import { cn } from "@/lib/utils";
import { CaptureFields } from "./capture-fields";
import { PersonForm } from "./person-form";

export const KIN_KINDS = [
  "add-father",
  "add-mother",
  "add-spouse",
  "add-son",
  "add-daughter",
  "add-brother",
  "add-sister",
] as const;

export type KinKind = (typeof KIN_KINDS)[number];

export function isKinKind(kind: DialogKind): kind is KinKind {
  return KIN_KINDS.includes(kind as KinKind);
}

const PILL_LABEL: Record<KinKind, string> = {
  "add-father": copy.addFather,
  "add-mother": copy.addMother,
  "add-spouse": copy.addSpouse,
  "add-son": copy.addSonFull,
  "add-daughter": copy.addDaughterFull,
  "add-brother": copy.addBrotherFull,
  "add-sister": copy.addSisterFull,
};

function lockedGender(kind: KinKind, targetGender?: Gender | null): Gender | null {
  if (kind === "add-son" || kind === "add-brother" || kind === "add-father") return "male";
  if (kind === "add-daughter" || kind === "add-sister" || kind === "add-mother") return "female";
  if (kind === "add-spouse" && targetGender) return targetGender === "male" ? "female" : "male";
  return null;
}

function isRepeatable(kind: KinKind): boolean {
  return kind === "add-son" || kind === "add-daughter" || kind === "add-brother" || kind === "add-sister";
}

async function attachPending(personId: string, photo: File | null, grave: File | null, photoSize: "sm" | "md" | "lg" = "md") {
  const { setPhoto, addDocument } = useTreeStore.getState();
  const edge = PHOTO_EDGE[photoSize];
  if (photo) {
    const id = crypto.randomUUID();
    await putMedia(id, await compressImage(photo, edge));
    setPhoto(personId, id);
  }
  if (grave) {
    const id = crypto.randomUUID();
    const blob = grave.type.startsWith("image/") ? await compressImage(grave, edge) : grave;
    await putMedia(id, blob);
    addDocument(personId, { id, kind: "grave", name: grave.name, mime: blob.type || grave.type });
  }
}

export function AddKinDialog() {
  const dialog = useTreeStore((s) => s.dialog);
  const openDialog = useTreeStore((s) => s.openDialog);
  const closeDialog = useTreeStore((s) => s.closeDialog);
  const people = useTreeStore((s) => s.people);
  const dialogPersonId = useTreeStore((s) => s.dialogPersonId);
  const selectedId = useTreeStore((s) => s.selectedId);
  const open = isKinKind(dialog);
  const targetId = (open ? dialogPersonId : selectedId) ?? selectedId;
  const target = targetId ? (people[targetId] ?? null) : null;
  const kind: KinKind = open ? dialog : "add-son";

  const addChild = useTreeStore((s) => s.addChild);
  const addSpouse = useTreeStore((s) => s.addSpouse);
  const addParent = useTreeStore((s) => s.addParent);
  const addSibling = useTreeStore((s) => s.addSibling);
  const linkExistingChild = useTreeStore((s) => s.linkExistingChild);
  const linkExistingSpouse = useTreeStore((s) => s.linkExistingSpouse);
  const linkExistingParent = useTreeStore((s) => s.linkExistingParent);
  const linkExistingSibling = useTreeStore((s) => s.linkExistingSibling);

  const spouses = target ? spousesOf(people, target) : [];
  const spouseKey = spouses.map((s) => s.id).join(",");
  const genderLock = lockedGender(kind, target?.gender);

  const defaults = useMemo(() => {
    if (!target) return emptyDraft({ gender: genderLock ?? "male" });
    if (kind === "add-son" || kind === "add-daughter") {
      return emptyDraft({
        ...inheritChildNames(target, spouses[0] ?? null),
        gender: kind === "add-daughter" ? "female" : "male",
        birthPlace: target.residence || target.birthPlace,
        residence: target.residence,
        countryCode: target.countryCode,
      });
    }
    if (kind === "add-brother" || kind === "add-sister") {
      return emptyDraft({
        gender: kind === "add-sister" ? "female" : "male",
        fatherName: target.fatherName,
        familyName: target.familyName,
        birthPlace: target.birthPlace,
        residence: target.residence,
        countryCode: target.countryCode,
      });
    }
    if (kind === "add-spouse") {
      return emptyDraft({
        gender: target.gender === "male" ? "female" : "male",
        residence: target.residence,
        countryCode: target.countryCode,
      });
    }
    if (kind === "add-father") {
      return emptyDraft({
        gender: "male",
        givenName: target.fatherName,
        familyName: target.familyName,
        countryCode: target.countryCode,
      });
    }
    return emptyDraft({ gender: "female", countryCode: target.countryCode });
  }, [target, kind, spouseKey, genderLock]);

  const [draft, setDraft] = useState<PersonDraft>(defaults);
  const [otherId, setOtherId] = useState<string | null>(spouses[0]?.id ?? null);
  const [added, setAdded] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [grave, setGrave] = useState<File | null>(null);
  const [existingQuery, setExistingQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(defaults);
    setOtherId(spouses[0]?.id ?? null);
    setPhoto(null);
    setGrave(null);
    setResetKey((k) => k + 1);
    setExistingQuery("");
    // Reset only when opening or switching ابن/ابنة — not after each حفظ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, targetId]);

  const existingMatches = useMemo(
    () => (target ? searchPeopleByName(people, existingQuery, target.id) : []),
    [people, existingQuery, target],
  );

  useEffect(() => {
    if (open) setAdded(0);
  }, [open, targetId]);

  const switchKind = (next: KinKind) => {
    if (!target) return;
    if (next === "add-father" && target.fatherId) return;
    if (next === "add-mother" && target.motherId) return;
    openDialog(next, target.id);
  };

  const save = async () => {
    if (!target || !draft.givenName.trim()) {
      toast.error(copy.required);
      return;
    }
    let id = "";
    if (kind === "add-son" || kind === "add-daughter") id = addChild(target.id, draft, otherId);
    else if (kind === "add-spouse") {
      const status = draft.wifeKind || "current";
      if (!canAddWife(target, spouses, status)) {
        toast.error(copy.maxWivesReached);
        return;
      }
      id = addSpouse(target.id, { ...draft, wifeKind: status });
    }
    else if (kind === "add-father") id = addParent(target.id, "father", draft);
    else if (kind === "add-mother") id = addParent(target.id, "mother", draft);
    else id = addSibling(target.id, draft);
    if (!id) return;
    await attachPending(id, photo, grave, draft.photoSize);
    toast.success(copy.childSaved(fullName(draft)));
    if (isRepeatable(kind)) {
      setDraft({
        ...defaults,
        givenName: "",
        birthDate: "",
        birthPlace: draft.birthPlace,
        residence: draft.residence,
        countryCode: draft.countryCode,
      });
      setPhoto(null);
      setGrave(null);
      setAdded((n) => n + 1);
      setResetKey((k) => k + 1);
      return;
    }
    closeDialog();
  };

  const pickExisting = (person: Person) => {
    if (!target) return;
    let ok = true;
    if (kind === "add-son" || kind === "add-daughter") ok = linkExistingChild(target.id, person.id, otherId);
    else if (kind === "add-spouse") linkExistingSpouse(target.id, person.id);
    else if (kind === "add-father") ok = linkExistingParent(target.id, person.id, "father");
    else if (kind === "add-mother") ok = linkExistingParent(target.id, person.id, "mother");
    else ok = linkExistingSibling(target.id, person.id);
    if (!ok) {
      toast.error(copy.linkExistingBlocked);
      return;
    }
    toast.success(copy.linkedExisting);
    closeDialog();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeDialog()}>
      <DialogContent
        showClose
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>
            {kind === "add-spouse" && target
              ? nextSpouseTitle(target, spouses.length, draft.wifeKind || "current")
              : PILL_LABEL[kind]}
          </DialogTitle>
          {target ? (
            <DialogDescription>
              {fullName(target)}
              {isRepeatable(kind) ? ` · ${copy.addedCount(added)}` : ""}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="flex flex-wrap justify-end gap-1.5">
          {KIN_KINDS.map((k) => {
            const disabled =
              Boolean(k === "add-father" && target?.fatherId) ||
              Boolean(k === "add-mother" && target?.motherId);
            return (
              <button
                key={k}
                type="button"
                disabled={disabled}
                onClick={() => switchKind(k)}
                className={cn(
                  "h-8 rounded-full px-3 text-xs font-medium",
                  kind === k ? "bg-chip text-cream" : "bg-paper text-ink-soft shadow-[0_0_0_1px_rgba(28,33,28,0.1)]",
                  disabled && "opacity-40",
                )}
              >
                {PILL_LABEL[k]}
              </button>
            );
          })}
        </div>

        <div className="space-y-2 rounded-xl bg-cream px-3 py-3">
          <p className="text-sm font-medium text-ink">{copy.linkExistingSearchLabel}</p>
          <p className="text-xs text-muted">{copy.linkExistingSearchHint}</p>
          <Input
            value={existingQuery}
            onChange={(e) => setExistingQuery(e.target.value)}
            placeholder={copy.linkExistingSearchPlaceholder}
            autoComplete="off"
          />
          {existingQuery.trim().length >= 2 ? (
            existingMatches.length ? (
              <ul className="space-y-1">
                {existingMatches.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-2 rounded-lg bg-paper px-2 py-1.5">
                    <span className="min-w-0 text-xs leading-5 text-ink">{lineageHint(people, p)}</span>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-male hover:underline"
                      onClick={() => pickExisting(p)}
                    >
                      {copy.linkExistingButton}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">{copy.linkExistingNoResults}</p>
            )
          ) : null}
        </div>

        {kind === "add-spouse" && target?.gender === "male" ? (
          <div className="rounded-xl bg-cream px-3 py-3 text-sm">
            {spouses.length ? (
              <>
                <p className="mb-1.5 text-xs font-medium text-ink-soft">{copy.wives}</p>
                <ul className="space-y-1">
                  {spouses.map((s, i) => (
                    <li key={s.id}>{spouseRankLabel(s, i)}</li>
                  ))}
                </ul>
                {canAddWife(target, spouses, "current") ? (
                  <p className="mt-2 font-medium text-ink">
                    {copy.willBeWife(wifeOrdinal(currentWifeCount(spouses)))} ({currentWifeCount(spouses)}/٤ حالية)
                  </p>
                ) : (
                  <p className="mt-2 text-ink-soft">{copy.maxWivesReached}</p>
                )}
              </>
            ) : (
              <p className="text-ink-soft">{copy.firstWifeHint}</p>
            )}
            <p className="mt-2 text-xs text-muted">{copy.maxWives}</p>
          </div>
        ) : null}

        {kind === "add-son" || kind === "add-daughter"
          ? target?.gender === "male" && spouses.length
            ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">
                {kind === "add-daughter" ? copy.daughterFromWife : copy.sonFromWife}
              </p>
              <p className="text-xs text-muted">{copy.wifePickerHint}</p>
              <div className="grid gap-2">
                {spouses.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setOtherId(s.id)}
                    className={cn(
                      "rounded-xl px-3 py-2.5 text-right text-sm font-medium",
                      otherId === s.id
                        ? "bg-chip text-cream"
                        : "bg-paper text-ink-soft shadow-[0_0_0_1px_rgba(28,33,28,0.1)]",
                    )}
                  >
                    {spouseRankLabel(s, i)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setOtherId(null)}
                  className={cn(
                    "rounded-xl px-3 py-2 text-right text-sm",
                    otherId === null
                      ? "bg-chip text-cream"
                      : "bg-paper text-muted shadow-[0_0_0_1px_rgba(28,33,28,0.08)]",
                  )}
                >
                  {copy.none}
                </button>
              </div>
            </div>
          ) : null
          : null}

        <div key={`${kind}-${resetKey}`} className="space-y-3">
          <PersonForm
            value={draft}
            onChange={setDraft}
            autoFocus
            formId={`kin-${kind}-${resetKey}`}
            lockGender={Boolean(genderLock)}
            showWifeKind={kind === "add-spouse" && target?.gender === "male"}
            excludeId={target?.id}
            onPickExisting={pickExisting}
            graveFile={grave}
            onGraveFile={setGrave}
          />
          <CaptureFields
            photo={photo}
            onPhoto={setPhoto}
            photoSize={draft.photoSize || "md"}
            photoScale={draft.photoScale || 1}
            photoX={draft.photoX ?? 50}
            photoY={draft.photoY ?? 50}
            onPhotoSize={(photoSize) => setDraft((d) => ({ ...d, photoSize }))}
            onPhotoScale={(photoScale) => setDraft((d) => ({ ...d, photoScale }))}
            onPhotoPos={(photoX, photoY) => setDraft((d) => ({ ...d, photoX, photoY }))}
          />
        </div>
        <DialogFooter>
          <Button onClick={() => void save()}>{isRepeatable(kind) ? copy.saveAndNext : copy.save}</Button>
          <Button variant="outline" onClick={closeDialog}>
            {isRepeatable(kind) ? copy.finishAdding : copy.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
