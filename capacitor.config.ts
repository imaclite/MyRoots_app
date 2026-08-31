import type { CapacitorConfig } from '@capacitor/cli';

// ملاحظة مهمة: هذا التطبيق يُصدَّر من Vercel كخادم SSR (صفحة تُبنى وقت الطلب)
// وليس كموقع ثابت (static)، لذلك لا يوجد ملف index.html جاهز محليًا يمكن أن
// يشير إليه Capacitor مباشرة عبر webDir التقليدي. الحل العملي: نجعل تطبيق
// الجوال/سطح المكتب (عبر Capacitor) يفتح رابط الموقع المنشور فعليًا على
// الإنترنت — تمامًا كما يفعل أي تطبيق PWA مُغلَّف — وبما أن عامل الخدمة
// (Service Worker) مُفعَّل مسبقًا في المشروع، يستمر التطبيق بالعمل بلا إنترنت
// بعد أول فتح، وبياناتك تبقى محفوظة محليًا في الجهاز كما هي الآن.
//
// بعد نشر المشروع على Vercel (الخطوة 1 في ملف "التثبيت-على-الأجهزة.md")
// استبدل الرابط أدناه برابطك الحقيقي، ثم شغّل: npx cap sync
const DEPLOYED_URL = 'https://REPLACE-WITH-YOUR-VERCEL-URL.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.hamrani.nasab',
  appName: 'نسب',
  webDir: '.vercel/output/static',
  server: {
    url: DEPLOYED_URL,
    cleartext: false,
  },
};

export default config;
