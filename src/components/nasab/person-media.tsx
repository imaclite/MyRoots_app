import { FileText, MapPin, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/tree/copy";
import { mapsHref } from "@/lib/tree/countries";
import { personToDraft } from "@/lib/tree/format";
import { compressImage, downloadBlob, getMedia, putMedia } from "@/lib/tree/media";
import { useTreeStore } from "@/lib/tree/store";
import { PHOTO_EDGE, type DocumentKind, type Person, type PersonDocument } from "@/lib/tree/types";
import { useMediaUrl } from "@/hooks/use-media-url";
import { PhotoAdjust } from "./photo-adjust";

const MAX_BYTES = 8 * 1024 * 1024;

const KIND_LABEL: Record<DocumentKind, string> = {
  birth: copy.birthCert,
  death: copy.deathCert,
  photo: copy.photo,
  grave: copy.otherDoc,
  other: copy.otherDoc,
};

function isImageDoc(doc: PersonDocument) {
  return doc.mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(doc.name);
}

function isPdfDoc(doc: PersonDocument) {
  return doc.mime === "application/pdf" || /\.pdf$/i.test(doc.name);
}

export function PersonMedia({ person }: { person: Person }) {
  const setPhoto = useTreeStore((s) => s.setPhoto);
  const addDocument = useTreeStore((s) => s.addDocument);
  const renameDocument = useTreeStore((s) => s.renameDocument);
  const removeDocument = useTreeStore((s) => s.removeDocument);
  const updatePerson = useTreeStore((s) => s.updatePerson);
  const photoUrl = useMediaUrl(person.photoId);
  const photoRef = useRef<HTMLInputElement>(null);
  const map = mapsHref(person.burialGps || person.burialPlace);
  const [extras, setExtras] = useState(false);
  const [viewing, setViewing] = useState<PersonDocument | null>(null);

  const attach = async (kind: DocumentKind, file: File, asPortrait = false) => {
    if (file.size > MAX_BYTES) {
      toast.error(copy.fileTooBig);
      return;
    }
    const id = crypto.randomUUID();
    const blob = file.type.startsWith("image/") ? await compressImage(file, PHOTO_EDGE[person.photoSize || "md"]) : file;
    await putMedia(id, blob);
    if (asPortrait) {
      setPhoto(person.id, id);
      toast.success(copy.photoSaved);
    } else {
      addDocument(person.id, { id, kind, name: file.name, mime: blob.type || file.type, title: KIND_LABEL[kind] });
      toast.success(copy.fileSaved);
    }
  };

  const patch = (partial: { photoSize?: Person["photoSize"]; photoScale?: number; photoX?: number; photoY?: number }) => {
    updatePerson(person.id, { ...personToDraft(person), ...partial });
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="mb-2 text-xs font-medium text-ink-soft">{copy.photo}</p>
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <Button size="sm" variant="outline" onClick={() => photoRef.current?.click()}>
              {person.photoId ? copy.changePhoto : copy.addFile}
            </Button>
            {person.photoId ? (
              <Button size="sm" variant="ghost" onClick={() => setPhoto(person.id, null)}>
                {copy.delete}
              </Button>
            ) : null}
          </div>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void attach("photo", file, true);
            }}
          />
        </div>
        <div className="mt-3">
          <PhotoAdjust
            size={person.photoSize || "md"}
            scale={person.photoScale || 1}
            x={person.photoX ?? 50}
            y={person.photoY ?? 50}
            onSize={(photoSize) => patch({ photoSize })}
            onScale={(photoScale) => patch({ photoScale })}
            onPos={(photoX, photoY) => patch({ photoX, photoY })}
            src={photoUrl}
          />
        </div>
      </div>

      {extras || person.burialPlace || person.burialGps ? (
        <div className="space-y-2">
          <button type="button" className="text-xs text-muted hover:underline" onClick={() => setExtras((v) => !v)}>
            {extras ? copy.hideOptional : copy.optionalFields}
          </button>
          {extras ? (
            <>
              {(person.burialPlace || person.burialGps) && (
                <div className="rounded-lg bg-cream px-3 py-2">
                  {person.burialPlace ? <p className="mt-0.5">{person.burialPlace}</p> : null}
                  {map ? (
                    <a
                      href={map}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1.5 text-sm text-male hover:underline"
                    >
                      <MapPin className="size-3.5" />
                      {copy.openMap}
                    </a>
                  ) : null}
                </div>
              )}
            </>
          ) : null}
        </div>
      ) : (
        <button type="button" className="text-xs text-muted hover:underline" onClick={() => setExtras(true)}>
          {copy.optionalFields} — {copy.showOptional}
        </button>
      )}

      <div>
        <p className="mb-2 text-xs font-medium text-ink-soft">{copy.documents}</p>
        <div className="mb-2 flex flex-wrap gap-2">
          <FilePicker label={copy.birthCert} accept="image/*,.pdf" onFile={(f) => void attach("birth", f)} />
          <FilePicker label={copy.deathCert} accept="image/*,.pdf" onFile={(f) => void attach("death", f)} />
          <FilePicker label={copy.otherDoc} accept="image/*,.pdf" onFile={(f) => void attach("other", f)} />
        </div>
        {person.documents.length ? (
          <ul className="space-y-2">
            {person.documents.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                onView={() => setViewing(doc)}
                onRename={(title) => renameDocument(person.id, doc.id, title)}
                onDelete={() => removeDocument(person.id, doc.id)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">{copy.noDocs}</p>
        )}
      </div>

      {viewing ? <DocViewer doc={viewing} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}

function DocRow({
  doc,
  onView,
  onRename,
  onDelete,
}: {
  doc: PersonDocument;
  onView: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const url = useMediaUrl(doc.id);
  const image = isImageDoc(doc);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(doc.title || KIND_LABEL[doc.kind]);
  const save = () => {
    const next = title.trim();
    if (next) onRename(next);
    setEditing(false);
  };
  return (
    <li className="rounded-lg bg-cream px-2 py-1.5">
      <div className="flex items-center gap-2">
        <button type="button" className="size-12 shrink-0 overflow-hidden rounded-md bg-paper" onClick={onView}>
          {image && url ? (
            <img src={url} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-muted">
              <FileText className="size-5" />
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => e.key === "Enter" && save()}
              className="h-8 w-full rounded-md bg-paper px-2 text-sm shadow-[0_0_0_1px_rgba(28,33,28,0.1)] outline-none"
              autoFocus
              aria-label={copy.docTitle}
            />
          ) : (
            <button type="button" className="block w-full truncate text-right text-sm font-medium" onClick={() => setEditing(true)}>
              {doc.title || KIND_LABEL[doc.kind]}
            </button>
          )}
          <span className="block truncate text-[11px] text-muted">{doc.name}</span>
        </div>
        <button type="button" className="text-xs text-male hover:underline" onClick={onView}>
          {copy.viewFile}
        </button>
        <button type="button" className="text-xs text-muted hover:underline" onClick={() => setEditing(true)}>
          {copy.renameDoc}
        </button>
        <button
          type="button"
          className="text-xs text-muted hover:underline"
          onClick={async () => {
            const blob = await getMedia(doc.id);
            if (blob) downloadBlob(blob, doc.name);
          }}
        >
          {copy.downloadSave}
        </button>
        <button type="button" className="text-muted hover:text-danger" aria-label={copy.delete} onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {editing ? (
        <div className="mt-1.5 flex flex-wrap justify-end gap-1">
          {copy.docPresets.map((label) => (
            <button
              key={label}
              type="button"
              className="h-7 rounded-full bg-paper px-2 text-[11px] text-ink-soft shadow-[0_0_0_1px_rgba(28,33,28,0.08)]"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setTitle(label);
                onRename(label);
                setEditing(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function DocViewer({ doc, onClose }: { doc: PersonDocument; onClose: () => void }) {
  const url = useMediaUrl(doc.id);
  const image = isImageDoc(doc);
  const pdf = isPdfDoc(doc);
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-ink/80 p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-cream">
        <p className="min-w-0 truncate text-sm">
          {doc.title || KIND_LABEL[doc.kind]} · {doc.name}
        </p>
        <button type="button" className="rounded-md p-1 hover:bg-cream/15" onClick={onClose} aria-label={copy.close}>
          <X className="size-5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-xl bg-paper p-2">
        {!url ? (
          <p className="text-sm text-muted">{copy.noDocs}</p>
        ) : image ? (
          <img src={url} alt={doc.name} className="max-h-full max-w-full object-contain" />
        ) : pdf ? (
          <iframe title={doc.name} src={url} className="h-full min-h-[70vh] w-full rounded-lg bg-paper" />
        ) : (
          <div className="space-y-3 text-center">
            <FileText className="mx-auto size-10 text-muted" />
            <p className="text-sm">{doc.name}</p>
            <Button
              size="sm"
              onClick={async () => {
                const blob = await getMedia(doc.id);
                if (blob) downloadBlob(blob, doc.name);
              }}
            >
              {copy.downloadSave}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilePicker({
  label,
  accept,
  onFile,
}: {
  label: string;
  accept: string;
  onFile: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => ref.current?.click()}>
        <Upload className="size-3.5" />
        {label}
      </Button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}
