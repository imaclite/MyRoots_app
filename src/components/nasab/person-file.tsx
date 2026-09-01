import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { copy } from "@/lib/tree/copy";
import { deathLine, formatEvent, fullName, initials } from "@/lib/tree/format";
import {
  canAddWife,
  childrenGroupedByOtherParent,
  spouseRankLabel,
  spousesOf,
  wifeOrdinal,
} from "@/lib/tree/graph";
import { useTreeStore } from "@/lib/tree/store";
import type { Person } from "@/lib/tree/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Flag } from "./flag";
import { PersonMedia } from "./person-media";

export function PersonFile() {
  const people = useTreeStore((s) => s.people);
  const fileId = useTreeStore((s) => s.fileId);
  const closeFile = useTreeStore((s) => s.closeFile);
  const person = fileId ? people[fileId] : null;
  const openedAt = useRef(0);

  useEffect(() => {
    openedAt.current = Date.now();
  }, [fileId]);

  if (!person) return null;

  const requestClose = () => {
    if (Date.now() - openedAt.current < 450) return;
    closeFile();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" onClick={requestClose} aria-label={copy.close} />
      <aside
        data-ui
        className="relative z-10 flex max-h-[min(94dvh,46rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-paper shadow-[0_24px_64px_-24px_rgba(28,33,28,0.45)] sm:rounded-xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-ink/8 px-4 py-3">
          <span
            className={cn(
              "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-cream",
              person.gender === "female" ? "bg-female" : "bg-male",
            )}
          >
            {initials(person)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-base font-semibold">
              <Flag code={person.countryCode} />
              <span className="truncate">{fullName(person)}</span>
            </p>
            <p className="text-xs text-muted">
              {person.gender === "male" ? copy.male : copy.female}
              {person.residence ? ` · ${person.residence}` : ""}
            </p>
            {person.kunya ? <p className="text-xs text-muted">{copy.kunya}: {person.kunya}</p> : null}
            {formatEvent(copy.bornAbbr, person.birthDate, person.birthPlace) ? (
              <p className="text-xs text-muted">{formatEvent(copy.bornAbbr, person.birthDate, person.birthPlace)}</p>
            ) : null}
            {deathLine(copy.diedAbbr, copy.deceased, person) ? (
              <p className="text-xs text-muted">{deathLine(copy.diedAbbr, copy.deceased, person)}</p>
            ) : null}
          </div>
          <button type="button" className="rounded-md p-1 text-muted hover:bg-cream hover:text-ink" onClick={closeFile}>
            <X className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {person.occupation ? <p className="text-sm">{person.occupation}</p> : null}
          {person.notes ? <p className="whitespace-pre-wrap text-sm text-ink-soft">{person.notes}</p> : null}
          <FileActions person={person} />
          <PersonMedia person={person} />
        </div>
      </aside>
    </div>
  );
}

function RelLink({ id, label }: { id: string; label: string }) {
  const openFile = useTreeStore((s) => s.openFile);
  return (
    <button type="button" className="block w-full truncate text-right text-sm hover:underline" onClick={() => openFile(id)}>
      {label}
    </button>
  );
}

function FileActions({ person }: { person: Person }) {
  const people = useTreeStore((s) => s.people);
  const openDialog = useTreeStore((s) => s.openDialog);
  const setFocus = useTreeStore((s) => s.setFocus);
  const setView = useTreeStore((s) => s.setView);
  const closeFile = useTreeStore((s) => s.closeFile);
  const unlinkSpouse = useTreeStore((s) => s.unlinkSpouse);
  const reorderChild = useTreeStore((s) => s.reorderChild);
  const unlinkChild = useTreeStore((s) => s.unlinkChild);
  const spouses = spousesOf(people, person);
  const groups = childrenGroupedByOtherParent(people, person);
  const canCurrent = canAddWife(person, spouses, "current");
  const spouseLabel =
    person.gender === "male"
      ? canCurrent
        ? spouses.length
          ? `الزوجة ${wifeOrdinal(spouses.length)}`
          : copy.addSpouse
        : copy.previousWife
      : copy.addHusband;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium text-ink-soft">{copy.kin}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => openDialog("add-son", person.id)}>
            {copy.addSonFull}
          </Button>
          <Button size="sm" variant="outline" onClick={() => openDialog("add-daughter", person.id)}>
            {copy.addDaughterFull}
          </Button>
          <Button size="sm" variant="outline" onClick={() => openDialog("add-brother", person.id)}>
            {copy.addBrotherFull}
          </Button>
          <Button size="sm" variant="outline" onClick={() => openDialog("add-sister", person.id)}>
            {copy.addSisterFull}
          </Button>
          {!person.fatherId ? (
            <Button size="sm" variant="outline" onClick={() => openDialog("add-father", person.id)}>
              {copy.addFather}
            </Button>
          ) : null}
          {!person.motherId ? (
            <Button size="sm" variant="outline" onClick={() => openDialog("add-mother", person.id)}>
              {copy.addMother}
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => openDialog("add-spouse", person.id)}>
            {spouseLabel}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => openDialog("edit", person.id)}>
          {copy.edit}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setFocus(person.id);
            setView("tree");
          }}
        >
          {copy.makeFocus}
        </Button>
        <Button size="sm" variant="danger" onClick={() => openDialog("confirm-delete", person.id)}>
          {copy.delete}
        </Button>
        <Button size="sm" variant="ghost" onClick={closeFile}>
          {copy.close}
        </Button>
      </div>
      {spouses.length ? (
        <div>
          <p className="mb-1 text-xs font-medium text-ink-soft">{person.gender === "male" ? copy.wives : copy.spouse}</p>
          <ul className="space-y-1">
            {spouses.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <RelLink id={s.id} label={spouseRankLabel(s, i)} />
                <button
                  type="button"
                  className="shrink-0 text-xs font-medium text-muted hover:text-danger hover:underline"
                  onClick={() => {
                    if (!window.confirm(copy.confirmUnlinkSpouse(fullName(s)))) return;
                    unlinkSpouse(person.id, s.id);
                    toast.success(copy.unlinkedSpouse);
                  }}
                >
                  {copy.removeSpouseLink}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {(person.fatherId && people[person.fatherId]) || (person.motherId && people[person.motherId]) ? (
        <div>
          <p className="mb-1 text-xs font-medium text-ink-soft">{copy.parents}</p>
          <ul className="space-y-1">
            {person.fatherId && people[person.fatherId] ? (
              <li className="flex items-center justify-between gap-2">
                <RelLink id={person.fatherId} label={`${copy.fatherOf} ${fullName(people[person.fatherId]!)}`} />
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-muted hover:text-ink hover:underline"
                    onClick={() => openDialog("add-father", person.id)}
                  >
                    {copy.changeParentLink}
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-muted hover:text-danger hover:underline"
                    onClick={() => {
                      const father = people[person.fatherId!]!;
                      if (!window.confirm(copy.confirmUnlinkChild(fullName(person), fullName(father)))) return;
                      unlinkChild(person.id, father.id);
                      toast.success(copy.unlinkedChild);
                    }}
                  >
                    {copy.removeParentLink}
                  </button>
                </span>
              </li>
            ) : null}
            {person.motherId && people[person.motherId] ? (
              <li className="flex items-center justify-between gap-2">
                <RelLink id={person.motherId} label={`${copy.motherOf} ${fullName(people[person.motherId]!)}`} />
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-muted hover:text-ink hover:underline"
                    onClick={() => openDialog("add-mother", person.id)}
                  >
                    {copy.changeParentLink}
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-muted hover:text-danger hover:underline"
                    onClick={() => {
                      const mother = people[person.motherId!]!;
                      if (!window.confirm(copy.confirmUnlinkChild(fullName(person), fullName(mother)))) return;
                      unlinkChild(person.id, mother.id);
                      toast.success(copy.unlinkedChild);
                    }}
                  >
                    {copy.removeParentLink}
                  </button>
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
      {groups.some((g) => g.children.length) ? (
        <div className="space-y-2">
          {groups.map((g) =>
            g.children.length ? (
              <div key={g.other?.id ?? "none"}>
                <p className="text-xs font-medium text-ink-soft">
                  {spouses.length > 1 && g.other ? `${copy.childrenFrom} ${g.label}` : copy.children}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {g.children.map((c, i) => {
                    const siblingIds = g.children.map((k) => k.id);
                    return (
                      <li key={c.id} className="flex items-center gap-1">
                        <div className="flex shrink-0 flex-col">
                          <button
                            type="button"
                            aria-label={copy.moveOlder}
                            disabled={i === 0}
                            className="rounded p-0.5 text-muted hover:bg-cream hover:text-ink disabled:opacity-20"
                            onClick={() => reorderChild(c.id, siblingIds, "up")}
                          >
                            <ChevronUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={copy.moveYounger}
                            disabled={i === g.children.length - 1}
                            className="rounded p-0.5 text-muted hover:bg-cream hover:text-ink disabled:opacity-20"
                            onClick={() => reorderChild(c.id, siblingIds, "down")}
                          >
                            <ChevronDown className="size-3.5" />
                          </button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <RelLink id={c.id} label={fullName(c)} />
                        </div>
                        <button
                          type="button"
                          className="shrink-0 text-xs font-medium text-muted hover:text-danger hover:underline"
                          onClick={() => {
                            if (!window.confirm(copy.confirmUnlinkChild(fullName(c), fullName(person)))) return;
                            unlinkChild(c.id, person.id);
                            toast.success(copy.unlinkedChild);
                          }}
                        >
                          {copy.removeParentLink}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}
