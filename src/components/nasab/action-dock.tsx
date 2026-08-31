import { Scan, Trash2, UserRound } from "lucide-react";
import { copy } from "@/lib/tree/copy";
import { fullName } from "@/lib/tree/format";
import { useTreeStore } from "@/lib/tree/store";
import { Button } from "@/components/ui/button";

const dockBtn = "text-cream hover:bg-cream/12 hover:text-cream";

export function ActionDock() {
  const selectedId = useTreeStore((s) => s.selectedId);
  const people = useTreeStore((s) => s.people);
  const openFile = useTreeStore((s) => s.openFile);
  const setFocus = useTreeStore((s) => s.setFocus);
  const openDialog = useTreeStore((s) => s.openDialog);
  const person = selectedId ? people[selectedId] : null;
  if (!person) return null;

  return (
    <div data-ui className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex justify-center px-3">
      <div
        data-ui
        className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-chip px-1.5 py-1 text-cream shadow-[var(--shadow-card)]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="hidden max-w-36 truncate px-2 text-xs font-medium text-cream/80 sm:block">{fullName(person)}</span>
        <Button size="sm" variant="ghost" className={dockBtn} onClick={() => openFile(person.id)}>
          <UserRound className="size-4" />
          {copy.openFile}
        </Button>
        <Button size="sm" variant="ghost" className={dockBtn} onClick={() => setFocus(person.id)}>
          <Scan className="size-4" />
          <span className="hidden sm:inline">{copy.makeFocus}</span>
        </Button>
        <Button size="sm" variant="ghost" className={dockBtn} onClick={() => openDialog("confirm-delete", person.id)}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
