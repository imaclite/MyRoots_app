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
import { copy } from "@/lib/tree/copy";
import { emptyDraft, fullName, personToDraft } from "@/lib/tree/format";
import { compressImage, putMedia } from "@/lib/tree/media";
import { useTreeStore } from "@/lib/tree/store";
import type { DialogKind } from "@/lib/tree/store";
import type { Person, PersonDraft } from "@/lib/tree/types";
import { PHOTO_EDGE } from "@/lib/tree/types";
import { useMediaUrl } from "@/hooks/use-media-url";
import { CaptureFields } from "./capture-fields";
import { AddKinDialog } from "./add-kin-dialog";
import { PersonForm } from "./person-form";

function dismiss(kind: DialogKind) {
  const s = useTreeStore.getState();
  if (s.dialog === kind) s.closeDialog();
}

function useTargetPerson() {
  const people = useTreeStore((s) => s.people);
  const dialogPersonId = useTreeStore((s) => s.dialogPersonId);
  const selectedId = useTreeStore((s) => s.selectedId);
  const id = dialogPersonId ?? selectedId;
  return id ? (people[id] ?? null) : null;
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

function PhotoCapture({
  draft,
  setDraft,
  photo,
  setPhoto,
  existingId,
}: {
  draft: PersonDraft;
  setDraft: (next: PersonDraft | ((d: PersonDraft) => PersonDraft)) => void;
  photo: File | null;
  setPhoto: (file: File | null) => void;
  existingId?: string | null;
}) {
  const existingUrl = useMediaUrl(existingId);
  return (
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
      existingUrl={existingUrl}
    />
  );
}

export function AppDialogs() {
  return (
    <>
      <AddKinDialog />
      <PersonActionDialog kind="add-person" />
      <PersonActionDialog kind="edit" />
      <PersonActionDialog kind="first-person" />
      <ConfirmNewDialog />
      <ConfirmDeleteDialog />
    </>
  );
}

function PersonActionDialog({
  kind,
}: {
  kind: "add-person" | "edit" | "first-person";
}) {
  const dialog = useTreeStore((s) => s.dialog);
  const closeDialog = useTreeStore((s) => s.closeDialog);
  const open = dialog === kind;
  const target = useTargetPerson();
  const addUnlinked = useTreeStore((s) => s.addUnlinked);
  const updatePerson = useTreeStore((s) => s.updatePerson);
  const setFocus = useTreeStore((s) => s.setFocus);

  const initial = useMemo(() => {
    if (kind === "edit" && target) return personToDraft(target);
    return emptyDraft();
  }, [kind, target]);

  const [draft, setDraft] = useState<PersonDraft>(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [grave, setGrave] = useState<File | null>(null);
  useEffect(() => {
    if (open) {
      setDraft(initial);
      setPhoto(null);
      setGrave(null);
    }
  }, [open, initial]);

  const titles: Record<typeof kind, string> = {
    "add-person": copy.addPerson,
    edit: copy.edit,
    "first-person": copy.firstPerson,
  };

  const save = async () => {
    if (!draft.givenName.trim()) {
      toast.error(copy.required);
      return;
    }
    let id = "";
    if (kind === "edit" && target) {
      updatePerson(target.id, draft);
      id = target.id;
    } else {
      id = addUnlinked(draft);
      if (kind === "first-person") setFocus(id);
    }
    if (id) await attachPending(id, photo, grave, draft.photoSize);
    toast.success(copy.childSaved(fullName(draft)));
    closeDialog();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss(kind)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{titles[kind]}</DialogTitle>
        </DialogHeader>
        <DialogFooter className="mt-0 mb-4 justify-end">
          <Button onClick={() => void save()}>{kind === "first-person" ? copy.create : copy.save}</Button>
          <Button variant="outline" onClick={closeDialog}>
            {copy.cancel}
          </Button>
        </DialogFooter>
        <div className="space-y-3">
          <PersonForm
            value={draft}
            onChange={setDraft}
            autoFocus
            excludeId={target?.id}
            showWifeKind={kind === "edit" && target?.gender === "female"}
            graveFile={grave}
            onGraveFile={setGrave}
          />
          <PhotoCapture
            draft={draft}
            setDraft={setDraft}
            photo={photo}
            setPhoto={setPhoto}
            existingId={kind === "edit" ? target?.photoId : null}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmNewDialog() {
  const open = useTreeStore((s) => s.dialog === "confirm-new");
  const closeDialog = useTreeStore((s) => s.closeDialog);
  const newTree = useTreeStore((s) => s.newTree);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss("confirm-new")}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.newTreeTitle}</DialogTitle>
          <DialogDescription>{copy.confirmNew}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            onClick={() => {
              newTree();
            }}
          >
            {copy.startNew}
          </Button>
          <Button variant="outline" onClick={closeDialog}>
            {copy.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDeleteDialog() {
  const open = useTreeStore((s) => s.dialog === "confirm-delete");
  const closeDialog = useTreeStore((s) => s.closeDialog);
  const deleteSelected = useTreeStore((s) => s.deleteSelected);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss("confirm-delete")}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.delete}</DialogTitle>
          <DialogDescription>{copy.confirmDelete}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="danger" onClick={deleteSelected}>
            {copy.delete}
          </Button>
          <Button variant="outline" onClick={closeDialog}>
            {copy.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
