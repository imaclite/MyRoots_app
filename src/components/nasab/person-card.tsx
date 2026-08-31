import { useEffect } from "react";

/**
 * يسجّل خدمة العامل (public/sw.js) بعد اكتمال التحميل حتى يعمل التطبيق بدون
 * إنترنت ويصبح قابلاً للتثبيت (Add to Home Screen / تثبيت) على ماك وآيفون
 * وآيباد وأندرويد. لا يفعل شيئًا في بيئات لا تدعم Service Worker.
 *
 * كما يراقب صدور نسخة جديدة من الموقع (بعد كل نشر جديد) ويعيد تحميل الصفحة
 * تلقائيًا مرة واحدة بمجرد أن تتولى النسخة الجديدة التحكم — بدل أن يبقى
 * المتصفح شغّالاً على نسخة قديمة مخزّنة إلى أن يعمل المستخدم تحديثًا يدويًا
 * لا يعرف عنه. هذا هو سبب ظهور مشاكل مثل "الميزة الجديدة ما تشتغل" رغم أن
 * الكود الصحيح منشور فعليًا على الموقع.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    const reloadOnce = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    // بمجرد ما نسخة عامل جديدة تتولى التحكم بالصفحة (بعد نشر جديد) — أعد التحميل
    // تلقائيًا مرة واحدة فقط حتى يحصل المستخدم على أحدث كود بدون أي خطوة يدوية.
    navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // تحقّق فورًا من وجود نسخة أحدث (مفيد إن كانت الصفحة مفتوحة من قبل
          // ونُشر تحديث جديد أثناء ذلك)، وأيضًا كل مرة يرجع فيها المستخدم للتطبيق.
          reg.update().catch(() => {});
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") reg.update().catch(() => {});
          });
        })
        .catch(() => {
          // تجاهل الفشل بصمت (مثلاً أثناء المعاينة داخل إطار لا يسمح به).
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", reloadOnce);
    };
  }, []);

  return null;
}
