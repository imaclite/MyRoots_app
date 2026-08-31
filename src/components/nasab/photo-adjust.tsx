import { useEffect, useRef, useState, type CSSProperties } from "react";
import { copy } from "@/lib/tree/copy";
import type { PhotoSize } from "@/lib/tree/types";
import { cn } from "@/lib/utils";

type Props = {
  size: PhotoSize;
  scale: number;
  x?: number;
  y?: number;
  onSize: (size: PhotoSize) => void;
  onScale: (scale: number) => void;
  onPos?: (x: number, y: number) => void;
  src?: string | null;
};

const SIZES: { id: PhotoSize; label: string }[] = [
  { id: "sm", label: copy.photoSmall },
  { id: "md", label: copy.photoMedium },
  { id: "lg", label: copy.photoLarge },
];

export const PHOTO_PX = {
  card: { sm: 18, md: 28, lg: 52 },
  preview: { sm: 44, md: 96, lg: 168 },
  details: { sm: 40, md: 72, lg: 128 },
} as const;

function clamp(n: number) {
  return Math.min(100, Math.max(0, n));
}

export function photoCropStyle(scale: number, x = 50, y = 50): CSSProperties {
  const s = Math.max(scale || 1, 1);
  return {
    position: "absolute",
    left: `${x}%`,
    top: `${y}%`,
    width: `${s * 100}%`,
    height: `${s * 100}%`,
    maxWidth: "none",
    transform: "translate(-50%, -50%)",
    objectFit: "cover",
  };
}

export function PhotoAdjust({ size, scale, x = 50, y = 50, onSize, onScale, onPos, src }: Props) {
  const px = PHOTO_PX.preview[size];
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [pos, setPos] = useState({ x, y });
  const posRef = useRef(pos);
  posRef.current = pos;

  useEffect(() => {
    setPos({ x, y });
  }, [x, y]);

  const move = (clientX: number, clientY: number) => {
    const st = drag.current;
    const el = frameRef.current;
    if (!st || !el) return;
    const rect = el.getBoundingClientRect();
    const next = {
      x: clamp(st.x - ((clientX - st.px) / Math.max(rect.width, 1)) * 100),
      y: clamp(st.y - ((clientY - st.py) / Math.max(rect.height, 1)) * 100),
    };
    posRef.current = next;
    setPos(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-ink-soft">{copy.photoSize}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {SIZES.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSize(opt.id)}
            className={cn(
              "h-9 rounded-lg text-xs font-medium",
              size === opt.id ? "bg-chip text-cream" : "bg-paper text-ink-soft shadow-[0_0_0_1px_rgba(28,33,28,0.08)]",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex min-h-[176px] items-center justify-center rounded-md bg-cream-deep/60 p-3">
        <div
          ref={frameRef}
          className={cn(
            "relative overflow-hidden rounded-md bg-cream-deep shadow-[0_0_0_1px_rgba(28,33,28,0.08)] transition-[width,height] duration-200",
            src && "cursor-grab touch-none active:cursor-grabbing",
          )}
          style={{ width: px, height: px }}
          onPointerDown={(e) => {
            if (!src) return;
            e.stopPropagation();
            e.preventDefault();
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            drag.current = { x: pos.x, y: pos.y, px: e.clientX, py: e.clientY };
          }}
          onPointerMove={(e) => move(e.clientX, e.clientY)}
          onPointerUp={(e) => {
            if (!drag.current) return;
            drag.current = null;
            onPos?.(posRef.current.x, posRef.current.y);
            try {
              (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          {src ? (
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none object-cover"
              style={photoCropStyle(scale, pos.x, pos.y)}
            />
          ) : (
            <span className="flex size-full items-center justify-center text-[10px] text-muted">{px}px</span>
          )}
        </div>
      </div>
      {src ? <p className="text-[11px] text-muted">{copy.dragPhoto}</p> : null}
      <label className="block text-xs text-muted">
        {copy.photoZoom}
        <input
          type="range"
          min={0.45}
          max={2.2}
          step={0.05}
          value={scale}
          onChange={(e) => onScale(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
    </div>
  );
}

export function photoFrameClass(size: PhotoSize | undefined): string {
  if (size === "sm") return "size-[18px]";
  if (size === "lg") return "size-[52px]";
  return "size-7";
}

export function photoPadClass(size: PhotoSize | undefined): string {
  if (size === "sm") return "pr-10";
  if (size === "lg") return "pr-[4.25rem]";
  return "pr-12";
}
