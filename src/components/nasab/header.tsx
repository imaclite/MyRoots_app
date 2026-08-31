import {
  Fan,
  GitFork,
  History,
  House,
  Redo2,
  Save,
  Share2,
  Undo2,
  UserPlus,
  Users,
} from "lucide-react";
import { copy } from "@/lib/tree/copy";
import { easternDigits } from "@/lib/tree/format";
import { generationSpan, peopleList } from "@/lib/tree/graph";
import { useTreeStore } from "@/lib/tree/store";
import type { ViewMode } from "@/lib/tree/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TABS: { id: ViewMode; label: string; icon: typeof GitFork }[] = [
  { id: "tree", label: copy.tree, icon: GitFork },
  { id: "houses", label: copy.houses, icon: House },
  { id: "fan", label: copy.fan, icon: Fan },
];

export function Header() {
  const view = useTreeStore((s) => s.view);
  const setView = useTreeStore((s) => s.setView);
  const people = useTreeStore((s) => s.people);
  const focusId = useTreeStore((s) => s.focusId);
  const treeName = useTreeStore((s) => s.treeName);
  const undo = useTreeStore((s) => s.undo);
  const redo = useTreeStore((s) => s.redo);
  const past = useTreeStore((s) => s.past);
  const future = useTreeStore((s) => s.future);
  const openDialog = useTreeStore((s) => s.openDialog);
  const dirty = useTreeStore((s) => s.dirty);
  const count = peopleList(people).length;
  const gens = generationSpan(people, focusId);

  return (
    <header className="relative z-20 border-b border-ink/8 bg-paper/90 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-chip text-cream shadow-[var(--shadow-chip)] sm:size-10">
            <GitFork className="size-5" />
          </div>
          <h1 className="text-base font-semibold text-ink sm:hidden">{copy.appName}</h1>
          <div className="hidden min-w-0 sm:block">
            <div className="flex items-baseline gap-2">
              <h1 className="text-lg font-semibold leading-none text-ink">{copy.appName}</h1>
              <span className="text-xs text-muted">{copy.tagline}</span>
            </div>
            <p className="mt-1 truncate text-xs text-muted">
              {treeName} · {easternDigits(String(count))} {copy.personCount}
              {gens ? ` · ${easternDigits(String(gens))} ${copy.generations}` : ""}
            </p>
          </div>
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-1">
          {dirty ? (
            <span className="hidden text-[11px] text-muted sm:inline">{copy.unsaved}</span>
          ) : null}
          <Button size="sm" onClick={() => openDialog("saves")}>
            <Save className="size-4" />
            <span>{copy.saveFile}</span>
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={copy.undo} disabled={!past.length} onClick={undo}>
            <Undo2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={copy.redo} disabled={!future.length} onClick={redo}>
            <Redo2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={copy.saves} onClick={() => openDialog("saves")}>
            <History className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={copy.familyForm}
            onClick={() => window.open("/family-form.html", "_blank", "noopener")}
          >
            <Share2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={copy.addPerson} onClick={() => openDialog("add-person")}>
            <UserPlus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={copy.people} onClick={() => openDialog("people")}>
            <Users className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex justify-center px-2 pb-2">
        <div className="flex rounded-full bg-cream-deep/80 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = view === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium sm:h-10 sm:px-5",
                  active ? "bg-chip text-cream shadow-[var(--shadow-chip)]" : "text-ink-soft hover:text-ink",
                )}
              >
                <Icon className="size-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
