import { fromGedcom, looksLikeGedcom, toGedcom } from "./gedcom";
import { normalizeTree, type SaveRecord, type TreeData } from "./types";

const CURRENT_KEY = "nasab:current";
const SAVES_KEY = "nasab:saves";
const MAX_SAVES = 40;

export function loadCurrent(): TreeData | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TreeData;
    if (parsed?.version !== 1 || !parsed.people) return null;
    return normalizeTree(parsed);
  } catch {
    return null;
  }
}

export function saveCurrent(data: TreeData): void {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function loadSaves(): SaveRecord[] {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SaveRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSaves(saves: SaveRecord[]): void {
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
  } catch {
    const trimmed = saves.slice(0, Math.ceil(MAX_SAVES / 2));
    try {
      localStorage.setItem(SAVES_KEY, JSON.stringify(trimmed));
    } catch {
      /* ignore */
    }
  }
}

export function persistTree(data: TreeData): void {
  saveCurrent(data);
}

export function rememberExplicitSave(data: TreeData, filename: string): SaveRecord {
  const record: SaveRecord = {
    id: crypto.randomUUID(),
    filename,
    action: "حفظ",
    personName: data.treeName || "شجرة",
    createdAt: new Date().toISOString(),
    data,
  };
  const saves = [record, ...loadSaves()].slice(0, MAX_SAVES);
  persistSaves(saves);
  return record;
}

export function downloadRecord(record: SaveRecord): void {
  downloadGedcom(record.filename, record.data);
}

export function gedcomFilename(filename: string): string {
  const safe = filename.replace(/[<>:"/\\|?*]/g, "-").trim() || "نسب-حالية.ged";
  return /\.ged$/i.test(safe) ? safe : `${safe.replace(/\.json$/i, "")}.ged`;
}

function triggerDownload(name: string, text: string): string {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 4000);
  return url;
}

export function canSaveFilePicker(): boolean {
  return typeof window !== "undefined" && typeof (window as { showSaveFilePicker?: unknown }).showSaveFilePicker === "function";
}

export function canShareGedcom(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  try {
    const probe = new File(["0 HEAD\n0 TRLR\n"], "nasab.ged", { type: "text/plain" });
    return typeof navigator.canShare === "function" ? navigator.canShare({ files: [probe] }) : false;
  } catch {
    return false;
  }
}

export async function saveGedcomToDisk(
  filename: string,
  data: TreeData,
): Promise<{ mode: "picked" | "shared" | "download" | "cancel"; filename: string; text: string }> {
  const name = gedcomFilename(filename);
  const text = toGedcom(data, name);
  const file = new File([text], name, { type: "text/plain" });

  if (typeof navigator.share === "function") {
    try {
      if (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return { mode: "shared", filename: name, text };
      }
    } catch (e) {
      if (typeof e === "object" && e && "name" in e && (e as { name: string }).name === "AbortError") {
        return { mode: "cancel", filename: name, text };
      }
    }
  }

  if (canSaveFilePicker()) {
    try {
      const w = window as unknown as {
        showSaveFilePicker: (o: unknown) => Promise<{
          name?: string;
          createWritable: () => Promise<{ write: (d: string) => Promise<void>; close: () => Promise<void> }>;
        }>;
      };
      const handle = await w.showSaveFilePicker({
        suggestedName: name,
        startIn: "documents",
        types: [
          {
            description: "GEDCOM family tree",
            accept: { "text/plain": [".ged"], "application/x-gedcom": [".ged"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return { mode: "picked", filename: handle.name || name, text };
    } catch (e) {
      if (typeof e === "object" && e && "name" in e && (e as { name: string }).name === "AbortError") {
        return { mode: "cancel", filename: name, text };
      }
    }
  }

  triggerDownload(name, text);
  return { mode: "download", filename: name, text };
}

export function downloadGedcom(filename: string, data: TreeData): void {
  const name = gedcomFilename(filename);
  triggerDownload(name, toGedcom(data, name));
}

export function parseTreeFile(text: string): TreeData {
  if (looksLikeGedcom(text)) return fromGedcom(text);
  return parseTreeJson(text);
}

export function parseTreeJson(text: string): TreeData {
  const parsed = JSON.parse(text) as TreeData;
  if (parsed?.version !== 1 || !parsed.people || typeof parsed.people !== "object") {
    throw new Error("ملف شجرة غير صالح");
  }
  return normalizeTree(parsed);
}

export function onCrashSave(getData: () => TreeData): () => void {
  const flush = () => {
    try {
      saveCurrent(getData());
    } catch {
      /* ignore */
    }
  };
  const vis = () => {
    if (document.visibilityState === "hidden") flush();
  };
  window.addEventListener("beforeunload", flush);
  document.addEventListener("visibilitychange", vis);
  return () => {
    window.removeEventListener("beforeunload", flush);
    document.removeEventListener("visibilitychange", vis);
  };
}
