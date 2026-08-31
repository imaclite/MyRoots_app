import { Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { layoutFullTree, layoutHourglass } from "@/lib/tree/layout";
import { useTreeStore } from "@/lib/tree/store";
import { spouseIdList, type LayoutNode, type Person } from "@/lib/tree/types";
import { fullName } from "@/lib/tree/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonCard } from "./person-card";

type Transform = { x: number; y: number; k: number };
type Mode = "index" | "family" | "focus";
type DropZone = "father" | "sibling";

const MIN_K = 0.28;
const MAX_K = 2.4;
// عدد الأشخاص الأدنى ليُعتبر اسم العائلة "فرعًا كبيرًا" له بطاقة خاصة في القائمة —
// هذا يستبعد تلقائيًا أسماء عائلات الزوجات اللي تزوجن للعائلة (زوجة واحدة = شخص واحد بعائلتها
// الأصلية)، ويُبقي فقط الفروع الحقيقية. لما تكتمل قراءة فروع مثل "الموسى"/"الرشيد"/"الطيب" من
// الملصق الأصلي وتكبر بياناتها، بطاقاتها راح تظهر تلقائيًا هنا بدون أي تعديل كود. يمكن أيضًا
// إظهار أي عائلة أصغر أو إخفاء عائلة أكبر يدويًا من زر "إضافة/إزالة عائلة" في الصفحة الرئيسية.
const MIN_FAMILY_SIZE = 5;

const MANUAL_KEY = "nasab.manualFamilies";
const HIDDEN_KEY = "nasab.hiddenFamilies";

// هل ancestorId يقع في سلسلة أجداد personId؟ نستخدمها قبل أي عملية سحب-وإفلات حتى لا نسمح
// بربط شخص كابن/أخ لأحد أحفاده (وهو ما يكوّن حلقة نسب غير منطقية).
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

// نحدد أقرب "هدف" صالح لعملية السحب، ونوع الربط المقترح:
// - "father": أفلتّ البطاقة فوق بطاقة أخرى مباشرة → يتبع هذا الشخص كابن/ابنة لصاحب البطاقة.
// - "sibling": أفلتّها بجانبها بنفس العمود (نفس الجيل) → يصبح أخًا/أختًا له (بنفس الوالدين).
function resolveDropTarget(params: {
  draggedId: string;
  worldX: number;
  worldY: number;
  nodes: LayoutNode[];
  people: Record<string, Person>;
}): { targetId: string; zone: DropZone } | null {
  const { draggedId, worldX, worldY, nodes, people } = params;
  const fatherCandidates: { targetId: string; dist: number }[] = [];
  const siblingCandidates: { targetId: string; dist: number }[] = [];
  for (const n of nodes) {
    if (n.id === draggedId) continue;
    const target = people[n.id];
    if (!target) continue;
    if (hasAncestor(n.id, draggedId, people)) continue;
    const cx = n.x + n.w / 2;
    const cy = n.y + n.h / 2;
    const dx = worldX - cx;
    const dy = worldY - cy;
    const dist = Math.hypot(dx, dy);
    const overlap = Math.abs(dx) < n.w * 0.62 && Math.abs(dy) < n.h * 0.62;
    if (overlap) {
      fatherCandidates.push({ targetId: n.id, dist });
      continue;
    }
    const sameColumn = Math.abs(dx) < n.w * 0.55;
    const closeVertically = Math.abs(dy) < n.h * 2.2;
    if (sameColumn && closeVertically && (target.fatherId || target.motherId)) {
      siblingCandidates.push({ targetId: n.id, dist });
    }
  }
  fatherCandidates.sort((a, b) => a.dist - b.dist);
  siblingCandidates.sort((a, b) => a.dist - b.dist);
  if (fatherCandidates.length) return { targetId: fatherCandidates[0]!.targetId, zone: "father" };
  if (siblingCandidates.length) return { targetId: siblingCandidates[0]!.targetId, zone: "sibling" };
  return null;
}

export function TreeCanvas() {
  const people = useTreeStore((s) => s.people);
  const focusId = useTreeStore((s) => s.focusId);
  const selectedId = useTreeStore((s) => s.selectedId);
  const setSelected = useTreeStore((s) => s.setSelected);
  const openFile = useTreeStore((s) => s.openFile);
  const linkExistingParent = useTreeStore((s) => s.linkExistingParent);
  const linkExistingSibling = useTreeStore((s) => s.linkExistingSibling);

  const [mode, setMode] = useState<Mode>("index");
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);

  const totalCount = Object.keys(people).length;

  // كل أسماء العائلات الموجودة فعليًا في البيانات (بلا أي فلترة بالحجم) — تُستخدم كأساس لقائمة
  // "إضافة/إزالة عائلة"، وأيضًا مصدر بطاقات الصفحة الرئيسية بعد تطبيق التخصيص اليدوي.
  const allFamilyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of Object.values(people)) {
      const fam = (p.familyName || "").trim();
      if (!fam) continue;
      counts.set(fam, (counts.get(fam) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ar"));
  }, [people]);

  // تخصيص المستخدم لقائمة العوائل: عائلات أُضيفت يدويًا رغم صغر عددها، وعائلات أُخفيت رغم
  // استيفائها للحد الأدنى (لتصحيح تجمّع خاطئ). يُحفظ محليًا في هذا الجهاز.
  const [manualFamilies, setManualFamilies] = useState<string[]>([]);
  const [hiddenFamilies, setHiddenFamilies] = useState<string[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [showSmallFamilies, setShowSmallFamilies] = useState(false);

  useEffect(() => {
    try {
      const m = localStorage.getItem(MANUAL_KEY);
      const h = localStorage.getItem(HIDDEN_KEY);
      if (m) setManualFamilies(JSON.parse(m));
      if (h) setHiddenFamilies(JSON.parse(h));
    } catch {
      // تخزين المتصفح قد يكون غير متاح في بعض البيئات — نتجاهل بأمان.
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(MANUAL_KEY, JSON.stringify(manualFamilies));
    } catch {
      // نفس الملاحظة أعلاه.
    }
  }, [manualFamilies]);
  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(hiddenFamilies));
    } catch {
      // نفس الملاحظة أعلاه.
    }
  }, [hiddenFamilies]);

  const isFamilyVisible = useCallback(
    (name: string, count: number) => {
      if (hiddenFamilies.includes(name)) return false;
      if (manualFamilies.includes(name)) return true;
      return count >= MIN_FAMILY_SIZE;
    },
    [hiddenFamilies, manualFamilies],
  );

  const toggleFamily = useCallback(
    (name: string, count: number) => {
      if (isFamilyVisible(name, count)) {
        if (manualFamilies.includes(name)) {
          setManualFamilies((prev) => prev.filter((n) => n !== name));
        } else {
          setHiddenFamilies((prev) => [...prev, name]);
        }
      } else {
        if (hiddenFamilies.includes(name)) {
          setHiddenFamilies((prev) => prev.filter((n) => n !== name));
        } else {
          setManualFamilies((prev) => [...prev, name]);
        }
      }
    },
    [isFamilyVisible, manualFamilies, hiddenFamilies],
  );

  // إضافة اسم عائلة جديد يدويًا — حتى لو ما فيه أي شخص مسجَّل بها بعد (مثل عائلة لسا ما اكتملت
  // قراءتها من الملصق الأصلي). يظهر بطاقتها فورًا في الصفحة الرئيسية بعدد "0" لحين إضافة أشخاص لها.
  const handleAddFamily = useCallback(() => {
    const name = newFamilyName.trim();
    if (!name) return;
    setHiddenFamilies((prev) => prev.filter((n) => n !== name));
    setManualFamilies((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setNewFamilyName("");
  }, [newFamilyName]);

  // العائلات الظاهرة فعليًا الآن في الصفحة الرئيسية — تشمل العائلات الكبيرة تلقائيًا + أي عائلة
  // أُضيفت يدويًا حتى لو عدد أفرادها صفر، وتستبعد ما أُخفي يدويًا.
  const familyGroups = useMemo(() => {
    const counts = new Map(allFamilyCounts);
    for (const name of manualFamilies) {
      if (!counts.has(name)) counts.set(name, 0);
    }
    return [...counts.entries()]
      .filter(([name, count]) => isFamilyVisible(name, count))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ar"));
  }, [allFamilyCounts, manualFamilies, isFamilyVisible]);

  // عائلات صغيرة موجودة فعلًا في البيانات لكنها غير ظاهرة حاليًا (أغلبها أسماء عائلات أصلية
  // لزوجات دخلن العائلة بالزواج) — نخفيها افتراضيًا لتبقى القائمة قصيرة ومريحة، وتظهر فقط عند
  // الحاجة لتصحيح خطأ (مثلاً عائلة صغيرة فعلية يجب أن تظهر).
  const smallFamilies = useMemo(
    () => allFamilyCounts.filter(([name, count]) => !isFamilyVisible(name, count)),
    [allFamilyCounts, isFamilyVisible],
  );

  // الدخول لأي عرض غير قائمة العوائل (شجرة كاملة/عائلة/التركيز على شخص) "تنقّل داخلي" —
  // نسجّله في تاريخ المتصفح حتى يكون لزر الرجوع بالجوال/المتصفح مكان يرجع له غير الخروج من
  // التطبيق كليًا. زر "كل العائلات" وزر رجوع الجهاز يستدعيان نفس السلوك (history.back()).
  const pushNav = useCallback(() => {
    try {
      window.history.pushState({ nasabTreeNav: true }, "");
    } catch {
      // بعض البيئات (مثل المعاينة داخل إطار iframe) قد تمنع history API — نتجاهل الخطأ بأمان.
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setMode("index");
      setSelectedFamily(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // كل مرة يتغيّر فيها الشخص "المركَّز عليه" أثناء وجودنا فعلاً على تبويب الشجرة (مثلاً زر
  // "التركيز" أسفل الشاشة) ننتقل تلقائيًا لعرض هذا الشخص وأقاربه، بدون التأثير على أول فتح للتبويب.
  const mountedRef = useRef(false);
  const prevFocusIdRef = useRef(focusId);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevFocusIdRef.current = focusId;
      return;
    }
    if (focusId && focusId !== prevFocusIdRef.current) {
      pushNav();
      setMode("focus");
    }
    prevFocusIdRef.current = focusId;
  }, [focusId, pushNav]);

  const filteredPeople = useMemo(() => {
    if (mode !== "family" || !selectedFamily) return people;
    const inFamily = Object.values(people).filter((p) => (p.familyName || "").trim() === selectedFamily);
    const idSet = new Set(inFamily.map((p) => p.id));
    for (const p of inFamily) {
      for (const sid of spouseIdList(p)) idSet.add(sid);
    }
    const out: typeof people = {};
    for (const id of idSet) {
      const person = people[id];
      if (person) out[id] = person;
    }
    return out;
  }, [people, mode, selectedFamily]);

  const layout = useMemo(() => {
    if (mode === "index") return { nodes: [], edges: [], bbox: { x: 0, y: 0, w: 800, h: 600 } };
    if (mode === "focus") return layoutHourglass(people, focusId);
    return layoutFullTree(filteredPeople);
  }, [people, focusId, mode, filteredPeople]);

  const nodesById = useMemo(() => {
    const map = new Map<string, LayoutNode>();
    for (const n of layout.nodes) map.set(n.id, n);
    return map;
  }, [layout.nodes]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const [tf, setTf] = useState<Transform>({ x: 40, y: 40, k: 1 });
  const tfRef = useRef(tf);
  tfRef.current = tf;
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
    pointers: Map<number, { x: number; y: number }>;
    pinch?: { dist: number; k: number };
  } | null>(null);

  // --- سحب بطاقة شخص لتغيير قرابتها (أب/أخ) ------------------------------------------------
  const personDrag = useRef<{ id: string; startClientX: number; startClientY: number } | null>(null);
  const [dragVisual, setDragVisual] = useState<{
    id: string;
    dx: number;
    dy: number;
    targetId: string | null;
    zone: DropZone | null;
  } | null>(null);
  const [pendingReparent, setPendingReparent] = useState<{
    draggedId: string;
    targetId: string;
    zone: DropZone;
  } | null>(null);

  const handleCardPointerDown = useCallback((id: string, e: React.PointerEvent<HTMLButtonElement>) => {
    personDrag.current = { id, startClientX: e.clientX, startClientY: e.clientY };
    setDragVisual({ id, dx: 0, dy: 0, targetId: null, zone: null });
  }, []);

  const handleCardPointerMove = useCallback(
    (id: string, e: React.PointerEvent<HTMLButtonElement>) => {
      const st = personDrag.current;
      if (!st || st.id !== id) return;
      const node = nodesById.get(id);
      if (!node) return;
      const k = tfRef.current.k;
      const dx = (e.clientX - st.startClientX) / k;
      const dy = (e.clientY - st.startClientY) / k;
      const worldX = node.x + node.w / 2 + dx;
      const worldY = node.y + node.h / 2 + dy;
      const target = resolveDropTarget({ draggedId: id, worldX, worldY, nodes: layout.nodes, people });
      setDragVisual({ id, dx, dy, targetId: target?.targetId ?? null, zone: target?.zone ?? null });
    },
    [nodesById, layout.nodes, people],
  );

  const handleCardPointerUp = useCallback(
    (id: string, e: React.PointerEvent<HTMLButtonElement>) => {
      const st = personDrag.current;
      personDrag.current = null;
      if (!st || st.id !== id) {
        setDragVisual(null);
        return;
      }
      const dxScreen = e.clientX - st.startClientX;
      const dyScreen = e.clientY - st.startClientY;
      if (Math.hypot(dxScreen, dyScreen) <= 10) {
        setDragVisual(null);
        return;
      }
      const node = nodesById.get(id);
      if (!node) {
        setDragVisual(null);
        return;
      }
      const k = tfRef.current.k;
      const dx = dxScreen / k;
      const dy = dyScreen / k;
      const worldX = node.x + node.w / 2 + dx;
      const worldY = node.y + node.h / 2 + dy;
      const target = resolveDropTarget({ draggedId: id, worldX, worldY, nodes: layout.nodes, people });
      if (!target) {
        setDragVisual(null);
        return;
      }
      setDragVisual({ id, dx, dy, targetId: target.targetId, zone: target.zone });
      setPendingReparent({ draggedId: id, targetId: target.targetId, zone: target.zone });
    },
    [nodesById, layout.nodes, people],
  );

  const cancelReparent = useCallback(() => {
    setPendingReparent(null);
    setDragVisual(null);
  }, []);

  const confirmReparent = useCallback(() => {
    if (!pendingReparent) return;
    const { draggedId, targetId, zone } = pendingReparent;
    if (zone === "father") {
      const targetPerson = people[targetId];
      const which = targetPerson?.gender === "female" ? "mother" : "father";
      linkExistingParent(draggedId, targetId, which);
    } else {
      linkExistingSibling(targetId, draggedId);
    }
    setPendingReparent(null);
    setDragVisual(null);
  }, [pendingReparent, people, linkExistingParent, linkExistingSibling]);

  const reparentMessage = useMemo(() => {
    if (!pendingReparent) return "";
    const dragged = people[pendingReparent.draggedId];
    const target = people[pendingReparent.targetId];
    if (!dragged || !target) return "";
    if (pendingReparent.zone === "father") {
      const role = dragged.gender === "female" ? "ابنة" : "ابنًا";
      return `سيصبح ${fullName(dragged)} ${role} لـ ${fullName(target)}، وستُرتَّب الشجرة تلقائيًا حسب هذه القرابة الجديدة. متابعة؟`;
    }
    const role = dragged.gender === "female" ? "أختًا" : "أخًا";
    return `سيصبح ${fullName(dragged)} ${role} لـ ${fullName(target)} (بنفس الوالدين)، وستُرتَّب الشجرة تلقائيًا. متابعة؟`;
  }, [pendingReparent, people]);
  // ------------------------------------------------------------------------------------------

  const fit = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    if (vw < 8 || vh < 8) return;
    const pad = 48;
    const bottomPad = 88;
    const k = Math.min(
      MAX_K,
      Math.max(MIN_K, Math.min((vw - pad * 2) / Math.max(layout.bbox.w, 1), (vh - pad - bottomPad) / Math.max(layout.bbox.h, 1))),
    );
    setTf((prev) => {
      const next = {
        k,
        x: (vw - layout.bbox.w * k) / 2,
        y: (vh - bottomPad - layout.bbox.h * k) / 2 + pad / 4,
      };
      if (Math.abs(prev.k - next.k) < 0.001 && Math.abs(prev.x - next.x) < 0.5 && Math.abs(prev.y - next.y) < 0.5) {
        return prev;
      }
      return next;
    });
  }, [layout.bbox.h, layout.bbox.w]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let frame = 0;
    const run = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fit());
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [fit, focusId, mode, selectedFamily]);

  const zoomAt = (cx: number, cy: number, factor: number) => {
    setTf((prev) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, prev.k * factor));
      const wx = (cx - prev.x) / prev.k;
      const wy = (cy - prev.y) / prev.k;
      return { k, x: cx - wx * k, y: cy - wy * k };
    });
  };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
    // نعيد ربط المستمع كل ما تغيّر العرض (mode/selectedFamily)، لأن عنصر الـ viewport نفسه
    // يُعاد إنشاؤه من الصفر (لا يوجد أصلاً وقت قائمة العوائل)، وإلا يتوقف تكبير السركول.
  }, [mode, selectedFamily]);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = viewportRef.current;
    if (!el) return;
    const hit = (e.target as HTMLElement | null)?.closest?.("[data-person-id],[data-ui]");
    if (hit) return;
    el.setPointerCapture(e.pointerId);
    if (!drag.current) {
      drag.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: tfRef.current.x,
        origY: tfRef.current.y,
        moved: false,
        pointers: new Map(),
      };
    }
    drag.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (drag.current.pointers.size === 2) {
      const pts = [...drag.current.pointers.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      drag.current.pinch = { dist, k: tfRef.current.k };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = drag.current;
    if (!st) return;
    st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (st.pointers.size === 2 && st.pinch) {
      const pts = [...st.pointers.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      const factor = dist / Math.max(st.pinch.dist, 1);
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = (pts[0]!.x + pts[1]!.x) / 2 - rect.left;
      const cy = (pts[0]!.y + pts[1]!.y) / 2 - rect.top;
      const k = Math.min(MAX_K, Math.max(MIN_K, st.pinch.k * factor));
      setTf((prev) => {
        const wx = (cx - prev.x) / prev.k;
        const wy = (cy - prev.y) / prev.k;
        return { k, x: cx - wx * k, y: cy - wy * k };
      });
      return;
    }
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (Math.hypot(dx, dy) > 4) st.moved = true;
    setTf({ k: tfRef.current.k, x: st.origX + dx, y: st.origY + dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const st = drag.current;
    if (st) {
      st.pointers.delete(e.pointerId);
      if (st.pointers.size < 2) st.pinch = undefined;
      if (st.pointers.size === 0) {
        if (!st.moved && !(e.target as HTMLElement | null)?.closest?.("[data-person-id]")) {
          setSelected(null);
        }
        drag.current = null;
      }
    }
  };

  const pathOf = (pts: { x: number; y: number }[]) => {
    if (!pts.length) return "";
    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  };

  const manageDialog = (
    <Dialog open={manageOpen} onOpenChange={setManageOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة أو إزالة عائلة</DialogTitle>
          <DialogDescription>
            أضف اسم عائلة جديدة — حتى لو ما فيها أشخاص مسجّلين بعد — لتظهر بطاقتها في الصفحة الرئيسية، أو أخفِ أي عائلة
            من القائمة الحالية.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={newFamilyName}
            onChange={(e) => setNewFamilyName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddFamily();
              }
            }}
            placeholder="اسم عائلة جديدة، مثل: الطيب"
            className="h-10 flex-1 rounded-lg border border-ink/10 bg-cream px-3 text-sm text-ink outline-none focus:border-chip"
          />
          <Button size="sm" onClick={handleAddFamily} disabled={!newFamilyName.trim()}>
            + إضافة
          </Button>
        </div>

        <p className="mb-1.5 text-xs font-medium text-muted">العائلات الظاهرة حاليًا في الصفحة الرئيسية</p>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {familyGroups.map(([name, count]) => (
            <div key={name} className="flex items-center justify-between rounded-lg bg-chip/10 px-3 py-2 text-sm text-ink">
              <span>آل {name}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-muted">{count} شخصًا</span>
                <button
                  type="button"
                  onClick={() => toggleFamily(name, count)}
                  className="text-xs font-medium text-danger hover:underline"
                >
                  إخفاء
                </button>
              </span>
            </div>
          ))}
          {familyGroups.length === 0 ? (
            <p className="px-1 py-3 text-center text-xs text-muted">لا توجد عائلات ظاهرة حاليًا.</p>
          ) : null}
        </div>

        {smallFamilies.length ? (
          <div className="mt-3 border-t border-ink/10 pt-3">
            <button
              type="button"
              onClick={() => setShowSmallFamilies((v) => !v)}
              className="text-xs font-medium text-chip hover:underline"
            >
              {showSmallFamilies
                ? "إخفاء العائلات الصغيرة الأخرى"
                : `عائلات صغيرة أخرى موجودة في البيانات (${smallFamilies.length}) — لتصحيح الأخطاء`}
            </button>
            {showSmallFamilies ? (
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {smallFamilies.map(([name, count]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleFamily(name, count)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-right text-xs text-muted transition hover:bg-cream-deep/50"
                  >
                    <span>آل {name}</span>
                    <span>{count} شخصًا</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button onClick={() => setManageOpen(false)}>تم</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const reparentDialog = (
    <Dialog open={Boolean(pendingReparent)} onOpenChange={(o) => !o && cancelReparent()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تأكيد تغيير القرابة</DialogTitle>
          <DialogDescription>{reparentMessage}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={cancelReparent}>
            إلغاء
          </Button>
          <Button onClick={confirmReparent}>تأكيد</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (mode === "index") {
    return (
      <>
        <div className="h-full overflow-y-auto">
          <div className="mx-auto max-w-3xl p-4">
            <h2 className="mb-1 text-lg font-semibold text-ink">عائلات الشجرة</h2>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">اختر عائلة لتصفّح شجرتها فقط، أو افتح الشجرة كاملة من هنا.</p>
              <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
                + إضافة / إزالة عائلة
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  pushNav();
                  setSelectedFamily(null);
                  setMode("family");
                }}
                className="rounded-xl bg-chip p-4 text-right text-cream shadow-[var(--shadow-card)] transition hover:bg-ink"
              >
                <span className="block text-base font-semibold">الشجرة كاملة</span>
                <span className="block text-xs text-cream/80">كل الأشخاص المسجّلين ({totalCount})</span>
              </button>
              {familyGroups.map(([name, count]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    pushNav();
                    setSelectedFamily(name);
                    setMode("family");
                  }}
                  className="rounded-xl bg-paper p-4 text-right shadow-[var(--shadow-card)] transition hover:bg-cream-deep/50"
                >
                  <span className="block text-base font-semibold text-ink">آل {name}</span>
                  <span className="block text-xs text-muted">{count} شخصًا</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        {manageDialog}
        {reparentDialog}
      </>
    );
  }

  return (
    <>
      <div className="relative h-full min-h-0 w-full">
        <div
          ref={viewportRef}
          className="tree-grid absolute inset-x-0 top-0 bottom-24 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className="absolute top-0 left-0 origin-top-left will-change-transform"
            style={{
              width: layout.bbox.w,
              height: layout.bbox.h,
              transform: `translate(${tf.x}px, ${tf.y}px) scale(${tf.k})`,
            }}
          >
            <svg
              className="pointer-events-none absolute inset-0"
              width={layout.bbox.w}
              height={layout.bbox.h}
              fill="none"
            >
              {layout.edges.map((edge) => (
                <path
                  key={edge.id}
                  d={pathOf(edge.points)}
                  stroke="currentColor"
                  className="text-line"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
            </svg>
            {layout.nodes.map((node) => {
              const person = people[node.id];
              if (!person) return null;
              const isDragging = dragVisual?.id === node.id;
              return (
                <PersonCard
                  key={person.id}
                  person={person}
                  node={node}
                  selected={selectedId === person.id}
                  focused={focusId === person.id}
                  onSelect={setSelected}
                  onOpen={openFile}
                  draggable
                  isDragging={isDragging}
                  dragDX={isDragging ? dragVisual.dx : 0}
                  dragDY={isDragging ? dragVisual.dy : 0}
                  dropZone={dragVisual?.targetId === node.id ? dragVisual.zone : null}
                  onDragPointerDown={handleCardPointerDown}
                  onDragPointerMove={handleCardPointerMove}
                  onDragPointerUp={handleCardPointerUp}
                />
              );
            })}
            {dragVisual
              ? (() => {
                  const node = nodesById.get(dragVisual.id);
                  if (!node) return null;
                  const label =
                    dragVisual.zone === "father" && dragVisual.targetId
                      ? `سيتبع: ${fullName(people[dragVisual.targetId] ?? ({} as Person))}`
                      : dragVisual.zone === "sibling" && dragVisual.targetId
                        ? `أخ/أخت لـ: ${fullName(people[dragVisual.targetId] ?? ({} as Person))}`
                        : "اسحب فوق شخص لربطه به كابن، أو بجانب أخيه ليصبح أخًا له";
                  return (
                    <div
                      className="pointer-events-none absolute z-50 -translate-y-full whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-cream shadow-[var(--shadow-card)]"
                      style={{ left: node.x + dragVisual.dx, top: node.y + dragVisual.dy - 8 }}
                    >
                      {label}
                    </div>
                  );
                })()
              : null}
          </div>
        </div>

        <div data-ui className="absolute top-4 left-4 z-40 flex items-center gap-2 rounded-xl bg-paper/90 p-1 shadow-[var(--shadow-card)]">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // نستخدم history.back() (بدل تغيير الحالة مباشرة) حتى يبقى تاريخ المتصفح متّسقًا مع
              // زر رجوع الجهاز — كلاهما الآن يرجعان لنفس الشيء (قائمة العوائل).
              window.history.back();
            }}
          >
            كل العائلات
          </Button>
          <span className="hidden max-w-40 truncate px-1 text-xs font-medium text-ink-soft sm:block">
            {mode === "focus" ? "شخص واحد وأقاربه" : selectedFamily ? `آل ${selectedFamily}` : "الشجرة كاملة"}
          </span>
        </div>

        <div data-ui className="absolute bottom-24 left-4 z-40 flex flex-col gap-1 rounded-xl bg-paper/90 p-1 shadow-[var(--shadow-card)]">
          <Button variant="ghost" size="icon-sm" aria-label="تكبير" onClick={() => {
            const el = viewportRef.current;
            if (!el) return;
            zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1.18);
          }}>
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="تصغير" onClick={() => {
            const el = viewportRef.current;
            if (!el) return;
            zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1 / 1.18);
          }}>
            <Minus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="ملاءمة" onClick={fit}>
            <Maximize2 className="size-4" />
          </Button>
        </div>
      </div>
      {manageDialog}
      {reparentDialog}
    </>
  );
}
