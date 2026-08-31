import { Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { layoutFullTree, layoutHourglass } from "@/lib/tree/layout";
import { useTreeStore } from "@/lib/tree/store";
import { spouseIdList } from "@/lib/tree/types";
import { Button } from "@/components/ui/button";
import { PersonCard } from "./person-card";

type Transform = { x: number; y: number; k: number };
type Mode = "index" | "family" | "focus";

const MIN_K = 0.28;
const MAX_K = 2.4;
// عدد الأشخاص الأدنى ليُعتبر اسم العائلة "فرعًا كبيرًا" له بطاقة خاصة في القائمة —
// هذا يستبعد تلقائيًا أسماء عائلات الزوجات اللي تزوجن للعائلة (زوجة واحدة = شخص واحد بعائلتها
// الأصلية)، ويُبقي فقط الفروع الحقيقية. لما تكتمل قراءة فروع مثل "الموسى"/"الرشيد"/"الطيب" من
// الملصق الأصلي وتكبر بياناتها، بطاقاتها راح تظهر تلقائيًا هنا بدون أي تعديل كود.
const MIN_FAMILY_SIZE = 5;

export function TreeCanvas() {
  const people = useTreeStore((s) => s.people);
  const focusId = useTreeStore((s) => s.focusId);
  const selectedId = useTreeStore((s) => s.selectedId);
  const setSelected = useTreeStore((s) => s.setSelected);
  const openFile = useTreeStore((s) => s.openFile);

  const [mode, setMode] = useState<Mode>("index");
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);

  const totalCount = Object.keys(people).length;
  const familyGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of Object.values(people)) {
      const fam = (p.familyName || "").trim();
      if (!fam) continue;
      counts.set(fam, (counts.get(fam) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= MIN_FAMILY_SIZE)
      .sort((a, b) => b[1] - a[1]);
  }, [people]);

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

  if (mode === "index") {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4">
          <h2 className="mb-1 text-lg font-semibold text-ink">عائلات الشجرة</h2>
          <p className="mb-4 text-sm text-muted">اختر عائلة لتصفّح شجرتها فقط، أو افتح الشجرة كاملة من هنا.</p>
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
    );
  }

  return (
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
            return (
              <PersonCard
                key={person.id}
                person={person}
                node={node}
                selected={selectedId === person.id}
                focused={focusId === person.id}
                onSelect={setSelected}
                onOpen={openFile}
              />
            );
          })}
        </div>
      </div>

      <div data-ui className="absolute top-4 left-4 z-40 flex items-center gap-2 rounded-xl bg-paper/90 p-1 shadow-[var(--shadow-card)]">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
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
  );
}
