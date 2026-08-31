import { useEffect, useState } from "react";
import { getMedia } from "@/lib/tree/media";

export function useMediaUrl(id: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setUrl(null);
      return;
    }
    let revoked: string | null = null;
    let cancelled = false;
    getMedia(id)
      .then((blob) => {
        if (cancelled || !blob) return;
        const next = URL.createObjectURL(blob);
        revoked = next;
        setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [id]);

  return url;
}
