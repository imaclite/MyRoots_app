import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copy } from "@/lib/tree/copy";
import { formatEvent, fullName, initials } from "@/lib/tree/format";
import { housesOf, type House } from "@/lib/tree/graph";
import { useHouseHeadLabel } from "@/lib/tree/house-head-label";
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

// نفس فكرة "إضافة/إزالة عائلة" في صفحة الشجرة، لكن هنا لكل بيت (زوجين) على حدة: افتراضيًا
// يظهر فقط بيت مُعلَّم صاحبه أو زوجته بعلامة "رأس بيت" (الحقل houseHead في ملف الشخص) — هذا
// يمنع ظهور كل زوجين في البيانات (قد يكونون عشرات) كبطاقة بيت مستقلة. المستخدم يقدر يظهر أي
// بيت آخر يدويًا، أو يخفي بيت رأس ظاهر افتراضيًا، ويُحفظ اختياره في هذا الجهاز.
const MANUAL_HOUSES_KEY = "nasab.manualHouses";
const HIDDEN_HOUSES_KEY = "nasab.hiddenHouses";

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
  blockedPersonId: string | null;
  blockedHouseId: string | null;
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
  blocked,
}: {
  person: Person;
  onPick: (id: string) => void;
  onPointerDownDrag: (id: string, e: React.PointerEvent<HTMLButtonElement>) => void;
  dimmed: boolean;
  highlighted: boolean;
  blocked: boolean;
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
        blocked && "ring-2 ring-danger",
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
  const [houseHeadLabel, setHouseHeadLabelValue] = useHouseHeadLabel();

  // --- تحديد أي البيوت تظهر كبطاقات في هذه الصفحة (بدل عرض كل زوجين تلقائيًا) --------------
  const [manualHouses, setManualHouses] = useState<string[]>([]);
  const [hiddenHouses, setHiddenHouses] = useState<string[]>([]);
  const [manageHousesOpen, setManageHousesOpen] = useState(false);
  const [houseSearch, setHouseSearch] = useState("");
  const [houseHeadLabelDraft, setHouseHeadLabelDraft] = useState(houseHeadLabel);

  useEffect(() => setHouseHeadLabelDraft(houseHeadLabel), [houseHeadLabel]);

  useEffect(() => {
    try {
      const m = localStorage.getItem(MANUAL_HOUSES_KEY);
      const h = localStorage.getItem(HIDDEN_HOUSES_KEY);
      if (m) setManualHouses(JSON.parse(m));
      if (h) setHiddenHouses(JSON.parse(h));
    } catch {
      // تخزين المتصفح قد يكون غير متاح في بعض البيئات — نتجاهل بأمان.
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(MANUAL_HOUSES_KEY, JSON.stringify(manualHouses));
    } catch {
      // نفس الملاحظة أعلاه.
    }
  }, [manualHouses]);
  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_HOUSES_KEY, JSON.stringify(hiddenHouses));
    } catch {
      // نفس الملاحظة أعلاه.
    }
  }, [hiddenHouses]);

  const houseLabel = useCallback(
    (house: House) => [house.husband, house.wife].filter(Boolean).map((p) => fullName(p as Person)).join(" و "),
    [],
  );

  const isHouseVisible = useCallback(
    (house: House) => {
      if (hiddenHouses.includes(house.id)) return false;
      if (manualHouses.includes(house.id)) return true;
      return Boolean(house.husband?.houseHead || house.wife?.houseHead);
    },
    [hiddenHouses, manualHouses],
  );

  const toggleHouse = useCallback(
    (house: House) => {
      if (isHouseVisible(house)) {
        if (manualHouses.includes(house.id)) {
          setManualHouses((prev) => prev.filter((id) => id !== house.id));
        } else {
          setHiddenHouses((prev) => [...prev, house.id]);
        }
      } else {
        if (hiddenHouses.includes(house.id)) {
          setHiddenHouses((prev) => prev.filter((id) => id !== house.id));
        } else {
          setManualHouses((prev) => [...prev, house.id]);
        }
      }
    },
    [isHouseVisible, manualHouses, hiddenHouses],
  );

  const visibleHouses = useMemo(() => houses.filter(isHouseVisible), [houses, isHouseVisible]);
  const otherHouses = useMemo(() => {
    const q = houseSearch.trim();
    return houses
      .filter((h) => !isHouseVisible(h))
      .filter((h) => !q || houseLabel(h).includes(q));
  }, [houses, isHouseVisible, houseSearch, houseLabel]);
  // -------------------------------------------------------------------------------------------

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
  // رسالة عابرة تشرح للمستخدم *لماذا* رجعت البطاقة مكانها بدل ما ترجع بصمت — تظهر فقط عند
  // رفض الإفلات لأنه يكوّن حلقة نسب غير منطقية (تسحب جدًا فوق أحد أحفاده مثلاً).
  const [dropNotice, setDropNotice] = useState<string | null>(null);
  const dropNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showDropNotice = useCallback((text: string) => {
    if (dropNoticeTimer.current) clearTimeout(dropNoticeTimer.current);
    setDropNotice(text);
    dropNoticeTimer.current = setTimeout(() => setDropNotice(null), 3200);
  }, []);
  useEffect(() => {
    return () => {
      if (dropNoticeTimer.current) clearTimeout(dropNoticeTimer.current);
    };
  }, []);

  const resolveTargetAt = useCallback(
    (clientX: number, clientY: number, draggedId: string) => {
      const empty = {
        targetPersonId: null as string | null,
        targetHouseId: null as string | null,
        blockedPersonId: null as string | null,
        blockedHouseId: null as string | null,
      };
      const el = document.elementFromPoint(clientX, clientY);
      const personEl = (el as HTMLElement | null)?.closest?.("[data-person-mini-id]") as HTMLElement | null;
      if (personEl) {
        const targetId = personEl.getAttribute("data-person-mini-id");
        if (targetId && targetId !== draggedId) {
          // شخص يُنشئ ربطه حلقة نسب غير منطقية (أحد أحفاد الشخص المسحوب) — نرفض لكن نُرجع
          // الهدف حتى نقدر نوضّح للمستخدم السبب بدل ما ترجع البطاقة بصمت.
          if (hasAncestor(targetId, draggedId, people)) return { ...empty, blockedPersonId: targetId };
          return { ...empty, targetPersonId: targetId };
        }
      }
      const houseEl = (el as HTMLElement | null)?.closest?.("[data-house-id]") as HTMLElement | null;
      if (houseEl) {
        const houseId = houseEl.getAttribute("data-house-id");
        const house = houses.find((h) => h.id === houseId);
        const isOwnHouse =
          !!house && ((house.husband && house.husband.id === draggedId) || (house.wife && house.wife.id === draggedId));
        if (house && !isOwnHouse && (house.husband || house.wife)) {
          const husbandCyclic = !!house.husband && hasAncestor(house.husband.id, draggedId, people);
          const wifeCyclic = !!house.wife && hasAncestor(house.wife.id, draggedId, people);
          if (husbandCyclic || wifeCyclic) return { ...empty, blockedHouseId: house.id };
          return { ...empty, targetHouseId: house.id };
        }
      }
      return empty;
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
        blockedPersonId: target.blockedPersonId,
        blockedHouseId: target.blockedHouseId,
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
      } else if (target.blockedPersonId || target.blockedHouseId) {
        const dragged = people[st.id];
        if (dragged) {
          const targetName = target.blockedPersonId
            ? fullName(people[target.blockedPersonId] ?? ({} as Person))
            : "هذه الأسرة";
          showDropNotice(`ما يصير: ${targetName} أصلاً من أحفاد ${fullName(dragged)} — ما ينربطون بهذا الاتجاه.`);
        }
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
  }, [resolveTargetAt, people, showDropNotice]);

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

  const manageHousesDialog = (
    <Dialog open={manageHousesOpen} onOpenChange={setManageHousesOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تحديد البيوت الظاهرة</DialogTitle>
          <DialogDescription>
            افتراضيًا يظهر فقط بيت الشخص المُعلَّم بـ「{houseHeadLabel}」من ملف الشخص. أظهر أي بيت آخر يدويًا من
            هنا، أو أخفِ بيتًا ظاهرًا حاليًا.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 space-y-1.5 rounded-lg bg-cream-deep/40 p-3">
          <label htmlFor="house-head-label-input" className="block text-xs font-medium text-muted">
            مصطلح "رأس البيت" (يظهر في ملف الشخص وعلى بطاقته)
          </label>
          <div className="flex gap-2">
            <input
              id="house-head-label-input"
              type="text"
              value={houseHeadLabelDraft}
              onChange={(e) => setHouseHeadLabelDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setHouseHeadLabelValue(houseHeadLabelDraft);
                }
              }}
              placeholder="مثال: رب الأسرة، الجد الأول..."
              className="h-10 flex-1 rounded-lg border border-ink/10 bg-cream px-3 text-sm text-ink outline-none focus:border-chip"
            />
            <Button size="sm" onClick={() => setHouseHeadLabelValue(houseHeadLabelDraft)}>
              حفظ
            </Button>
          </div>
        </div>

        <p className="mb-1.5 text-xs font-medium text-muted">البيوت الظاهرة حاليًا ({visibleHouses.length})</p>
        <div className="mb-3 max-h-48 space-y-1 overflow-y-auto">
          {visibleHouses.map((house) => (
            <div key={house.id} className="flex items-center justify-between gap-2 rounded-lg bg-chip/10 px-3 py-2 text-sm text-ink">
              <span className="truncate">{houseLabel(house) || "بلا اسم"}</span>
              <button
                type="button"
                onClick={() => toggleHouse(house)}
                className="shrink-0 text-xs font-medium text-danger hover:underline"
              >
                إخفاء
              </button>
            </div>
          ))}
          {visibleHouses.length === 0 ? (
            <p className="px-1 py-3 text-center text-xs text-muted">لا توجد بيوت ظاهرة حاليًا.</p>
          ) : null}
        </div>

        <div className="border-t border-ink/10 pt-3">
          <input
            type="text"
            value={houseSearch}
            onChange={(e) => setHouseSearch(e.target.value)}
            placeholder="ابحث عن بيت بالاسم لإظهاره..."
            className="mb-2 h-10 w-full rounded-lg border border-ink/10 bg-cream px-3 text-sm text-ink outline-none focus:border-chip"
          />
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {otherHouses.map((house) => (
              <button
                key={house.id}
                type="button"
                onClick={() => toggleHouse(house)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-right text-xs text-muted transition hover:bg-cream-deep/50"
              >
                <span className="truncate">{houseLabel(house) || "بلا اسم"}</span>
                <span className="shrink-0 font-medium text-chip">+ إظهار</span>
              </button>
            ))}
            {otherHouses.length === 0 ? <p className="px-1 py-3 text-center text-xs text-muted">لا نتائج.</p> : null}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => setManageHousesOpen(false)}>تم</Button>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">
            اسحب أي شخص وأفلته فوق شخص آخر ليصبح ابنًا/ابنة له، أو أفلته داخل بطاقة عائلة ليصبح من أبنائها.
          </p>
          <Button variant="outline" size="sm" onClick={() => setManageHousesOpen(true)}>
            + تحديد البيوت الظاهرة
          </Button>
        </div>
        {visibleHouses.length === 0 ? (
          <div className="rounded-xl bg-paper p-6 text-center text-sm text-muted shadow-[var(--shadow-card)]">
            لا توجد بيوت ظاهرة حاليًا. علّم شخصًا بـ「{houseHeadLabel}」من ملفه، أو{" "}
            <button
              type="button"
              onClick={() => setManageHousesOpen(true)}
              className="font-medium text-chip hover:underline"
            >
              أظهر بيتًا يدويًا من هنا
            </button>
            .
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleHouses.map((house) => (
            <article
              key={house.id}
              data-house-id={house.id}
              className={cn(
                "rounded-xl bg-paper p-4 shadow-[var(--shadow-card)] transition",
                dragVisual?.targetHouseId === house.id && "ring-2 ring-sky-500",
                dragVisual?.blockedHouseId === house.id && "ring-2 ring-danger",
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
                    blocked={dragVisual?.blockedPersonId === house.husband.id}
                  />
                ) : null}
                {house.wife ? (
                  <Mini
                    person={house.wife}
                    onPick={pick}
                    onPointerDownDrag={handlePointerDownDrag}
                    dimmed={dragVisual?.id === house.wife.id}
                    highlighted={dragVisual?.targetPersonId === house.wife.id}
                    blocked={dragVisual?.blockedPersonId === house.wife.id}
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
                      blocked={dragVisual?.blockedPersonId === c.id}
                    />
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
        )}
      </div>
      {dropNotice ? (
        <div className="pointer-events-none fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-danger px-4 py-2 text-xs font-medium text-cream shadow-[var(--shadow-card)]">
          {dropNotice}
        </div>
      ) : null}
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
      {manageHousesDialog}
    </div>
  );
}
