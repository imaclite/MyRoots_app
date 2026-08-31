import { ArrowDownToLine, Download, RotateCcw, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/tree/copy";
import { formatClock, fullName, initials } from "@/lib/tree/format";
import { peopleList } from "@/lib/tree/graph";
import { downloadRecord, parseTreeFile } from "@/lib/tree/storage";
import { useTreeStore } from "@/lib/tree/store";
import type { DialogKind } from "@/lib/tree/store";
import { cn } from "@/lib/utils";
import { Flag } from "./flag";

function dismiss(kind: DialogKind) {
  const s = useTreeStore.getState();
  if (s.dialog === kind) s.closeDialog();
}

export function SidePanels() {
  const dialog = useTreeStore((s) => s.dialog);
  return (
    <>
      <PeoplePanel open={dialog === "people"} onClose={() => dismiss("people")} />
      <SavesPanel open={dialog === "saves"} onClose={() => dismiss("saves")} />
    </>
  );
}

function PeoplePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const people = useTreeStore((s) => s.people);
  const openFile = useTreeStore((s) => s.openFile);
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const all = peopleList(people).sort((a, b) => fullName(a).localeCompare(fullName(b), "ar"));
    const query = q.trim();
    if (!query) return all;
    return all.filter((p) => fullName(p).includes(query) || p.givenName.includes(query));
  }, [people, q]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.people}</DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={copy.search} className="pr-9" />
        </div>
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {list.length ? (
            list.map((p) => (
              <button
                key={p.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-right hover:bg-cream-deep/70"
                onClick={() => {
                  openFile(p.id);
                  onClose();
                }}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md text-xs font-semibold text-cream",
                    p.gender === "male" ? "bg-male" : "bg-female",
                  )}
                >
                  {initials(p)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{fullName(p)}</span>
                <Flag code={p.countryCode} />
              </button>
            ))
          ) : (
            <p className="py-8 text-center text-sm text-muted">{copy.noPeople}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SavesPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const saves = useTreeStore((s) => s.saves);
  const restoreSave = useTreeStore((s) => s.restoreSave);
  const treeName = useTreeStore((s) => s.treeName);
  const lastSaveName = useTreeStore((s) => s.lastSaveName);
  const prepareSave = useTreeStore((s) => s.prepareSave);
  const fileRef = useRef<HTMLInputElement>(null);
  const importTree = useTreeStore((s) => s.importTree);
  const [filename, setFilename] = useState(lastSaveName || `${treeName || "نسب-حالية"}.ged`);
  const [href, setHref] = useState<string | null>(null);
  const [readyName, setReadyName] = useState("");

  async function handleSave() {
    const { filename: name, text } = prepareSave(filename);
    setFilename(name);
    const picker = (window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<{ name?: string; createWritable: () => Promise<{ write: (d: string) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker;
    if (typeof picker === "function") {
      try {
        const handle = await picker({
          suggestedName: name,
          startIn: "documents",
          id: "nasab-gedcom",
          types: [{ description: "GEDCOM 5.5.1", accept: { "text/plain": [".ged"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        setHref(null);
        toast.success(copy.savedPicked);
        return;
      } catch (e) {
        if (typeof e === "object" && e && "name" in e && (e as { name: string }).name === "AbortError") {
          return;
        }
      }
    }
    if (href) URL.revokeObjectURL(href);
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    setHref(url);
    setReadyName(name);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.saveAs}</DialogTitle>
          <DialogDescription>{copy.chooseWhere}</DialogDescription>
        </DialogHeader>
        <p className="mb-3 text-xs leading-5 text-muted">{copy.draftHint}</p>
        <div className="mb-4 space-y-2">
          <label className="text-xs font-medium text-ink-soft" htmlFor="save-name">
            {copy.fileName}
          </label>
          <div dir="ltr" className="flex items-center rounded-lg border border-input bg-background">
            <input
              id="save-name"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-left font-mono text-sm outline-none"
              value={filename.replace(/\.ged$/i, "")}
              onChange={(e) => setFilename(e.target.value)}
            />
            <span className="px-2 text-xs text-muted">.ged</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleSave()}>
              <Download className="size-4" />
              {copy.copyGed}
            </Button>
            {href ? (
              <Button asChild>
                <a href={href} download={readyName}>
                  {copy.downloadGed}
                </a>
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mb-3 border-t border-ink/8 pt-3">
          <p className="mb-2 text-xs text-muted">{copy.familyFormHint}</p>
          <Button variant="outline" onClick={() => window.open("/family-form.html", "_blank", "noopener")}>
            {copy.familyForm}
          </Button>
        </div>
        <div className="mb-3 border-t border-ink/8 pt-3">
          <p className="mb-2 text-xs text-muted">{copy.openExistingHint}</p>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <ArrowDownToLine className="size-4" />
            {copy.importFromUsb}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".ged,.json,application/x-gedcom,application/json,text/plain"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const data = parseTreeFile(await file.text());
              importTree(data);
              toast.success(copy.importDone);
              onClose();
            } catch {
              toast.error("ملف شجرة غير صالح");
            }
          }}
        />
        {saves.length ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted">{copy.browserOnly}</summary>
            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
              {saves.map((s) => (
                <div key={s.id} className="rounded-lg bg-cream px-3 py-2">
                  <p className="truncate font-mono text-[11px] text-ink" dir="ltr">
                    {s.filename}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {s.action} · {formatClock(s.createdAt)}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        restoreSave(s.id);
                        toast.success(copy.restoreDone);
                        onClose();
                      }}
                    >
                      <RotateCcw className="size-3.5" />
                      {copy.restoreSave}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => downloadRecord(s)}>
                      <Download className="size-3.5" />
                      {copy.downloadSave}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
