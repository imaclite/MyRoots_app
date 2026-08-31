import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copy } from "@/lib/tree/copy";
import { formatEvent, fullName, initials } from "@/lib/tree/format";
import { housesOf } from "@/lib/tree/graph";
import { useTreeStore } from "@/lib/tree/store";
import type { Person } from "@/lib/tree/types";
import { cn } from "@/lib/utils";
import { Flag } from "./flag";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// حد الحركة (بالبكسل) قبل ما نعتبر اللمسة "سحب" بدل "ضغطة عادية" لفتح ملف الشخص —
// نفس فكرة PersonCard في صفحة الشجرة.
const DRAG_CLICK_THRESHOLD = 6;

// هل ancestorId يقع في سلسلة أجداد personId؟ نفس منطق tree-canvas.tsx بالضبط —
// يمنع ربط شخص كابن لأحد أحفاده (حلقة نسب غير منطقية). مكرَّرة هنا محليًا (بدل
// استيراد مشترك) حتى لا نلمس ملف tree-canvas.tsx الذي يعمل بشكل صحيح حاليًا.
function hasAncestor(personId: string, ancestorId: string, people: Record<string, Person>): boolean {
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

type DragState = {
  id: string;
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
  width: number;
  moved: boolean;
} | null;

type DragVisual = {
  id: string;
  left: number;
  top: number;
  width: number;
  targetPersonId: string | null;
  targetHouseId: string | null;
} | null;

type PendingLink =
  | { kind: "person"; draggedId: string; targetId: string }
  | { kind: "house"; draggedId: string; houseId: string };

function Mini({
  person,
  onPick,
  onPointerDownDrag,
  dimmed,
  highlighted,
}: {
  person: Person;
  onPick: (id: string) => void;
  onPointerDownDrag: (id: string, e: React.PointerEvent<HTMLButtonElement>) => void;
  dimmed: boolean;
  highlighted: boolean;
}) {
  const male = person.gender === "male";
  const born = formatEvent(copy.bornAbbr, person.birthDate, person.birthPlace);
  return (
    <button
      type="button"
      data-person-mini-id={person.id}
      onPointerDown={(e) => onPointerDownDrag(person.id, e)}
      onClick={() => onPick(person.id)}
      className={cn(
        "person-card flex w-full items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-right transition",
        male ? "bg-male-fill" : "bg-female-fill",
        dimmed && "opacity-30",
        highlighted && "ring-2 ring-amber-500",
      )}
      style={{ touchAction: "none" }}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-cream",
          male ? "bg-male" : "bg-female",
        )}
      >
        {initials(person)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <Flag code={person.countryCode} />
          <span className="truncate text-sm font-semibold text-ink">{fullName(person)}</span>
        </span>
        {born ? <span className="block truncate text-xs text-muted">{born}</span> : null}
      </span>
    </button>
  );
}

export function HousesView() {
  const people = useTreeStore((s) => s.people);
  const openFile = useTreeStore((s) => s.openFile);
  const linkExistingParent = useTreeStore((s) => s.linkExistingParent);
  const houses = housesOf(people);

  const justDraggedRef = useRef(false);
  const pick = useCallback(
    (id: string) => {
      if (justDraggedRef.current) {
        justDraggedRef.current = false;
        return;
      }
      openFile(id);
    },
    [openFile],
  );

  const drag = useRef<DragState>(null);
  const [dragVisual, setDragVisual] = useState<DragVisual>(null);
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);

  const resolveTargetAt = useCallback(
    (clientX: number, clientY: number, draggedId: string) => {
      const el = document.elementFromPoint(clientX, clientY);
      const personEl = (el as HTMLElement | null)?.closest?.("[data-person-mini-id]") as HTMLElement | null;
      if (personEl) {
        const targetId = personEl.getAttribute("data-person-mini-id");
        if (targetId && targetId !== draggedId && !hasAncestor(targetId, draggedId, people)) {
          return { targetPersonId: targetId, targetHouseId: null as string | null };
        }
      }
      const houseEl = (el as HTMLElement | null)?.closest?.("[data-house-id]") as HTMLElement | null;
      if (houseEl) {
        const houseId = houseEl.getAttribute("data-house-id");
        const house = houses.find((h) => h.id === houseId);
        if (house) {
          const husbandOk = !house.husband || (house.husband.id !== draggedId && !hasAncestor(house.husband.id, draggedId, people));
          const wifeOk = !house.wife || (house.wife.id !== draggedId && !hasAncestor(house.wife.id, draggedId, people));
          const isOwnHouse =
            (house.husband && house.husband.id === draggedId) || (house.wife && house.wife.id === draggedId);
          if (husbandOk && wifeOk && !isOwnHouse && (house.husband || house.wife)) {
            return { targetPersonId: null as string | null, targetHouseId: house.id };
          }
        }
      }
      return { targetPersonId: null as string | null, targetHouseId: null as string | null };
    },
    [houses, people],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const st = drag.current;
      if (!st) return;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      if (!st.moved && Math.hypot(dx, dy) > DRAG_CLICK_THRESHOLD) st.moved = true;
      if (!st.moved) return;
      const target = resolveTargetAt(e.clientX, e.clientY, st.id);
      setDragVisual({
        id: st.id,
        left: st.originLeft + dx,
        top: st.originTop + dy,
        width: st.width,
        targetPersonId: target.targetPersonId,
        targetHouseId: target.targetHouseId,
      });
    };

    const onUp = (e: PointerEvent) => {
      const st = drag.current;
      drag.current = null;
      if (!st) return;
      if (!st.moved) {
        setDragVisual(null);
        return;
      }
      justDraggedRef.current = true;
      const target = resolveTargetAt(e.clientX, e.clientY, st.id);
      setDragVisual(null);
      if (target.targetPersonId) {
        setPendingLink({ kind: "person", draggedId: st.id, targetId: target.targetPersonId });
      } else if (target.targetHouseId) {
        setPendingLink({ kind: "house", draggedId: st.id, houseId: target.targetHouseId });
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [resolveTargetAt]);

  const handlePointerDownDrag = useCallback((id: string, e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    drag.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      width: rect.width,
      moved: false,
    };
  }, []);

  const cancelLink = useCallback(() => setPendingLink(null), []);

  const confirmLink = useCallback(() => {
    if (!pendingLink) return;
    if (pendingLink.kind === "person") {
      const target = people[pendingLink.targetId];
      const which = target?.gender === "female" ? "mother" : "father";
      linkExistingParent(pendingLink.draggedId, pendingLink.targetId, which);
    } else {
      const house = houses.find((h) => h.id === pendingLink.houseId);
      if (house?.husband) linkExistingParent(pendingLink.draggedId, house.husband.id, "father");
      if (house?.wife) linkExistingParent(pendingLink.draggedId, house.wife.id, "mother");
    }
    setPendingLink(null);
  }, [pendingLink, people, houses, linkExistingParent]);

  const linkMessage = useMemo(() => {
    if (!pendingLink) return "";
    const dragged = people[pendingLink.draggedId];
    if (!dragged) return "";
    if (pendingLink.kind === "person") {
      const target = people[pendingLink.targetId];
      if (!target) return "";
      const role = dragged.gender === "female" ? "ابنة" : "ابنًا";
      return `سيصبح ${fullName(dragged)} ${role} لـ ${fullName(target)}. متابعة؟`;
    }
    const house = houses.find((h) => h.id === pendingLink.houseId);
    const parents = [house?.husband, house?.wife].filter(Boolean).map((p) => fullName(p as Person)).join(" و ");
    return `سيصبح ${fullName(dragged)} من أبناء ${parents || "هذه الأسرة"}. متابعة؟`;
  }, [pendingLink, people, houses]);

  const linkDialog = (
    <Dialog open={Boolean(pendingLink)} onOpenChange={(o) => !o && cancelLink()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تأكيد تغيير القرابة</DialogTitle>
          <DialogDescription>{linkMessage}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={cancelLink}>
            إلغاء
          </Button>
          <Button onClick={confirmLink}>تأكيد</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!houses.length) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted">{copy.noHouses}</div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl p-4">
        <p className="mb-3 text-xs text-muted">
          اسحب أي شخص وأفلته فوق شخص آخر ليصبح ابنًا/ابنة له، أو أفلته داخل بطاقة عائلة ليصبح من أبنائها.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {houses.map((house) => (
            <article
              key={house.id}
              data-house-id={house.id}
              className={cn(
                "rounded-xl bg-paper p-4 shadow-[var(--shadow-card)] transition",
                dragVisual?.targetHouseId === house.id && "ring-2 ring-sky-500",
              )}
            >
              <h2 className="mb-3 text-sm font-semibold text-ink">
                {copy.houseOf} {[house.husband, house.wife].filter(Boolean).map((p) => p!.givenName).join(" و ")}
              </h2>
              <div className="space-y-2">
                {house.husband ? (
                  <Mini
                    person={house.husband}
                    onPick={pick}
                    onPointerDownDrag={handlePointerDownDrag}
                    dimmed={dragVisual?.id === house.husband.id}
                    highlighted={dragVisual?.targetPersonId === house.husband.id}
                  />
                ) : null}
                {house.wife ? (
                  <Mini
                    person={house.wife}
                    onPick={pick}
                    onPointerDownDrag={handlePointerDownDrag}
                    dimmed={dragVisual?.id === house.wife.id}
                    highlighted={dragVisual?.targetPersonId === house.wife.id}
                  />
                ) : null}
              </div>
              {house.children.length ? (
                <div className="mt-3 space-y-2 border-t border-ink/8 pt-3">
                  <p className="text-xs font-medium text-muted">{copy.children}</p>
                  {house.children.map((c) => (
                    <Mini
                      key={c.id}
                      person={c}
                      onPick={pick}
                      onPointerDownDrag={handlePointerDownDrag}
                      dimmed={dragVisual?.id === c.id}
                      highlighted={dragVisual?.targetPersonId === c.id}
                    />
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
      {dragVisual
        ? (() => {
            const person = people[dragVisual.id];
            if (!person) return null;
            const male = person.gender === "male";
            return (
              <div
                className={cn(
                  "person-card pointer-events-none fixed z-50 flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-right shadow-[0_18px_36px_-12px_rgba(28,33,28,0.45)]",
                  male ? "bg-male-fill" : "bg-female-fill",
                )}
                style={{ left: dragVisual.left, top: dragVisual.top, width: dragVisual.width }}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-cream",
                    male ? "bg-male" : "bg-female",
                  )}
                >
                  {initials(person)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{fullName(person)}</span>
              </div>
            );
          })()
        : null}
      {linkDialog}
    </div>
  );
}
