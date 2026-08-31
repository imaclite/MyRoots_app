import { memo, useRef } from "react";
import { copy } from "@/lib/tree/copy";
import { formatEvent, fullName, initials } from "@/lib/tree/format";
import type { LayoutNode, Person } from "@/lib/tree/types";
import { cn } from "@/lib/utils";
import { useMediaUrl } from "@/hooks/use-media-url";
import { Flag } from "./flag";
import { photoCropStyle, photoFrameClass, photoPadClass } from "./photo-adjust";

type DropZone = "father" | "sibling" | "blocked" | null;

type Props = {
  person: Person;
  node: LayoutNode;
  selected: boolean;
  focused: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  draggable?: boolean;
  isDragging?: boolean;
  dragDX?: number;
  dragDY?: number;
  dropZone?: DropZone;
  onDragPointerDown?: (id: string, e: React.PointerEvent<HTMLButtonElement>) => void;
  onDragPointerMove?: (id: string, e: React.PointerEvent<HTMLButtonElement>) => void;
  onDragPointerUp?: (id: string, e: React.PointerEvent<HTMLButtonElement>) => void;
};

// حد الحركة (بالبكسل على الشاشة) قبل ما نعتبر اللمسة "سحب" بدل "ضغطة عادية" —
// أي حركة أقل من هذا تُفتح كملف الشخص كالمعتاد.
const DRAG_CLICK_THRESHOLD = 6;

export const PersonCard = memo(function PersonCard({
  person,
  node,
  selected,
  focused,
  onSelect,
  onOpen,
  draggable = false,
  isDragging = false,
  dragDX = 0,
  dragDY = 0,
  dropZone = null,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
}: Props) {
  const female = person.gender === "female";
  const born = formatEvent(copy.bornAbbr, person.birthDate, person.birthPlace);
  const died = formatEvent(copy.diedAbbr, person.deathDate, person.deathPlace);
  const photo = useMediaUrl(person.photoId);

  // نتابع بداية اللمسة محليًا داخل البطاقة نفسها (بمعزل عن حالة الأب) حتى نقرر بثقة
  // وبدون أي تأخير هل نفتح ملف الشخص أو نتجاهل الضغطة لأنها كانت سحبًا فعليًا.
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (draggable) {
      startRef.current = { x: e.clientX, y: e.clientY };
      suppressClickRef.current = false;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // بعض المتصفحات القديمة قد لا تدعم setPointerCapture — نتجاهل بأمان.
      }
      onDragPointerDown?.(person.id, e);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggable || !startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.hypot(dx, dy) > DRAG_CLICK_THRESHOLD) suppressClickRef.current = true;
    onDragPointerMove?.(person.id, e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (draggable && startRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // نفس الملاحظة أعلاه.
      }
      onDragPointerUp?.(person.id, e);
    }
    startRef.current = null;
  };

  const open = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSelect(person.id);
    onOpen(person.id);
  };

  return (
    <button
      type="button"
      data-person-id={person.id}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={open}
      className={cn(
        "person-card absolute overflow-hidden rounded-lg text-right outline-none",
        female ? "bg-female-fill" : "bg-male-fill",
        selected && "ring-2 ring-chip/70",
        focused && "ring-2 ring-chip",
        dropZone === "father" && "ring-2 ring-amber-500",
        dropZone === "sibling" && "ring-2 ring-sky-500",
        dropZone === "blocked" && "ring-2 ring-danger",
        isDragging ? "z-50 shadow-[0_18px_36px_-12px_rgba(28,33,28,0.45)] cursor-grabbing" : "cursor-pointer",
      )}
      style={{
        left: node.x + (isDragging ? dragDX : 0),
        top: node.y + (isDragging ? dragDY : 0),
        width: node.w,
        height: node.h,
        touchAction: draggable ? "none" : undefined,
        transition: isDragging ? "none" : "left 160ms ease-out, top 160ms ease-out, box-shadow 120ms ease-out",
      }}
    >
      <span
        className={cn("absolute inset-y-0 right-0 w-1.5", female ? "bg-female" : "bg-male")}
        aria-hidden
      />
      <span
        className={cn(
          "absolute top-2.5 right-3.5 overflow-hidden rounded-md text-xs font-semibold text-cream",
          photoFrameClass(person.photoSize),
          female ? "bg-female" : "bg-male",
        )}
      >
        {photo ? (
          <img
            src={photo}
            alt=""
            className="object-cover"
            style={photoCropStyle(person.photoScale || 1, person.photoX, person.photoY)}
          />
        ) : (
          <span className="flex size-full items-center justify-center">{initials(person)}</span>
        )}
      </span>
      <span className={cn("block h-full px-3 py-2.5 pl-3", photoPadClass(person.photoSize), person.houseHead && "pb-7")}>
        {node.caption ? (
          <span className="mb-0.5 block truncate text-[10px] font-medium text-muted">{node.caption}</span>
        ) : null}
        <span className="flex min-w-0 items-center gap-1.5">
          <Flag code={person.countryCode} />
          <span className="truncate text-sm font-semibold text-ink">{fullName(person)}</span>
        </span>
        {born ? (
          <span className="mt-0.5 block truncate text-xs leading-5 text-muted">{born}</span>
        ) : null}
        {died ? (
          <span className="block truncate text-xs leading-5 text-muted">{died}</span>
        ) : null}
      </span>
      {person.houseHead ? (
        <span className="absolute inset-x-0 bottom-0 bg-chip py-0.5 text-center text-[10px] font-medium tracking-wide text-cream">
          {person.familyName || copy.houseHead}
        </span>
      ) : null}
    </button>
  );
});
