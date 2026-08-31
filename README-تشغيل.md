# نسب — تعليمات التشغيل

هذا أرشيف المشروع الكامل **بدون** `node_modules`.

## المتطلبات

- Node.js 20 أو أحدث
- npm

## التشغيل

```bash
npm install
npm run dev
```

يفتح على `http://localhost:8080`

## ماذا في الأرشيف

- `CHANGES_GROK.md` — كل الإضافات والتعديلات
- `package.json` و `package-lock.json`
- `src/` — الشجرة، البطاقات، GEDCOM، الحفظ
- `public/` — ومنه `family-form.html` نموذج تعبئة الأقارب
- `vite.config.ts` و `scripts/` — لازمان لتشغيل `npm run dev`

## ملاحظات

- التطبيق ويب (React + Vite) وليس Flutter.
- الحفظ: ملف `.ged` بصيغة GEDCOM 5.5.1.
- المسودة تُحفظ في المتصفح (`localStorage`).
