import { useEffect } from "react";

/**
 * يسجّل خدمة العامل (public/sw.js) بعد اكتمال التحميل حتى يعمل التطبيق بدون
 * إنترنت ويصبح قابلاً للتثبيت (Add to Home Screen / تثبيت) على ماك وآيفون
 * وآيباد وأندرويد. لا يفعل شيئًا في بيئات لا تدعم Service Worker.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // تجاهل الفشل بصمت (مثلاً أثناء المعاينة داخل إطار لا يسمح به).
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
