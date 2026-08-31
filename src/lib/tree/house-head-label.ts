import { useCallback, useEffect, useState } from "react";

// المصطلح المعروض بدل "رأس بيت" (تسمية شخص كجدّ/رب هذه العائلة) — يختاره المستخدم بنفسه
// من نافذة "تحديد البيوت الظاهرة" في صفحة البيوت، ويُحفظ في هذا الجهاز فقط.
const KEY = "nasab.houseHeadLabel";
const DEFAULT_LABEL = "رأس بيت";
const CHANGE_EVENT = "nasab:house-head-label-changed";

export function getHouseHeadLabel(): string {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.trim() ? v.trim() : DEFAULT_LABEL;
  } catch {
    return DEFAULT_LABEL;
  }
}

export function setHouseHeadLabel(label: string): void {
  const value = label.trim() || DEFAULT_LABEL;
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // تخزين المتصفح قد يكون غير متاح في بعض البيئات — نتجاهل بأمان.
  }
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: value }));
  } catch {
    // نفس الملاحظة أعلاه.
  }
}

// يُستخدم في أي مكوّن يعرض هذا المصطلح (بطاقة الشخص، نموذج التعديل، نافذة إعدادات البيوت)
// حتى يتحدّث فورًا في كل الشاشات المفتوحة بمجرد تغييره من أي واحدة منها.
export function useHouseHeadLabel(): [string, (label: string) => void] {
  const [label, setLabelState] = useState<string>(() => getHouseHeadLabel());

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setLabelState(typeof detail === "string" && detail.trim() ? detail : getHouseHeadLabel());
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const update = useCallback((next: string) => {
    setHouseHeadLabel(next);
  }, []);

  return [label, update];
}
