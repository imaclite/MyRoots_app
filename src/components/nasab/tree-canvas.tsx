import { Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { layoutFullTree, layoutHourglass } from "@/lib/tree/layout";
import { useTreeStore } from "@/lib/tree/store";
import { Button } from "@/components/ui/button";
import { PersonCard } from "./person-card";

type Transform = { x: number; y: number; k: number };

const MIN_K = 0.28;
const MAX_K = 2.4;

export function TreeCanvas() {
  const people = useTreeStore((s) => s.people);
  const focusId = useTreeStore((s) => s.focusId);
  const selectedId = useTreeStore((s) => s.selectedId);
  const setSelected = useTreeStore((s) => s.setSelected);
  const openFile = useTreeStore((s) => s.openFile);
  const [fullView, setFullView] = useState(true);

  const layout = useMemo(
    () => (fullView ? layoutFullTree(people) : layoutHourglass(people, focusId)),
    [people, focusId, fullView],
  );
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
  }, [fit, focusId, fullView]);

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
  }, []);

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

      <div data-ui className="absolute top-4 left-4 z-40 rounded-xl bg-paper/90 p-1 shadow-[var(--shadow-card)]">
        <Button
          variant={fullView ? "default" : "outline"}
          size="sm"
          onClick={() => setFullView((v) => !v)}
        >
          {fullView ? "الشجرة كاملة" : "شخص واحد وأقاربه"}
        </Button>
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
