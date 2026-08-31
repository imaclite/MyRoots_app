import { Camera, ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { copy } from "@/lib/tree/copy";
import type { PhotoSize } from "@/lib/tree/types";
import { Button } from "@/components/ui/button";
import { PhotoAdjust } from "./photo-adjust";

type Props = {
  photo: File | null;
  onPhoto: (file: File | null) => void;
  photoSize: PhotoSize;
  photoScale: number;
  photoX?: number;
  photoY?: number;
  onPhotoSize: (size: PhotoSize) => void;
  onPhotoScale: (scale: number) => void;
  onPhotoPos?: (x: number, y: number) => void;
  existingUrl?: string | null;
};

export function CaptureFields({
  photo,
  onPhoto,
  photoSize,
  photoScale,
  photoX = 50,
  photoY = 50,
  onPhotoSize,
  onPhotoScale,
  onPhotoPos,
  existingUrl,
}: Props) {
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!photo || !photo.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const src = preview || existingUrl || null;

  return (
    <div className="space-y-2 rounded-lg bg-cream px-3 py-2.5">
      <p className="text-xs font-medium text-ink-soft">{copy.personPhoto}</p>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" type="button" onClick={() => camRef.current?.click()}>
          <Camera className="size-3.5" />
          {copy.camera}
        </Button>
        <Button size="sm" variant="outline" type="button" onClick={() => libRef.current?.click()}>
          <ImagePlus className="size-3.5" />
          {copy.fromLibrary}
        </Button>
        {photo ? (
          <Button size="sm" variant="ghost" type="button" onClick={() => onPhoto(null)}>
            {copy.delete}
          </Button>
        ) : null}
      </div>
      <PhotoAdjust
        size={photoSize}
        scale={photoScale}
        x={photoX}
        y={photoY}
        onSize={onPhotoSize}
        onScale={onPhotoScale}
        onPos={onPhotoPos}
        src={src}
      />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const next = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (next) onPhoto(next);
        }}
      />
      <input
        ref={libRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const next = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (next) onPhoto(next);
        }}
      />
    </div>
  );
}
