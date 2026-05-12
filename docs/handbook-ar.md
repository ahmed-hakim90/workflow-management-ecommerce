# دليل المشروع Store OMS (عربي)

دليل تشغيل وربط الميزات لنظام إدارة الطلبات متعدد المستأجرين. للمرجع السريع بالإنجليزية راجع [README.md](../README.md). لبدء سريع وجدول متغيرات البيئة وقوائم اختبار واتساب ومخططات تدفق مبسطة راجع [PROJECT_AR.md](./PROJECT_AR.md).

## جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [المتطلبات والتشغيل المحلي](#المتطلبات-والتشغيل-المحلي)
3. [هيكلة المستودع](#هيكلة-المستودع)
4. [المصادقة والأدوار](#المصادقة-والأدوار)
5. [البيانات في Firestore](#البيانات-في-firestore)
6. [تدفق الطلبات والويبهوكات](#تدفق-الطلبات-والويبهوكات)
7. [ربط واتساب (WhatsApp Cloud API) — خطوة بخطوة](#ربط-واتساب-whatsapp-cloud-api--خطوة-بخطوة)
8. [أتمتة واتساب و n8n](#أتمتة-واتساب-و-n8n)
9. [الشحن (Bosta)](#الشحن-bosta)
10. [الإنتاج (مثلاً Vercel)](#الإنتاج-مثلاً-vercel)
11. [وثائق إضافية](#وثائق-إضافية)

---

## نظرة عامة

**Store OMS** هو نظام إدارة طلبات (Order Management) موجّه للإنتاج:

- **واجهة:** Next.js (App Router)، React، Tailwind.
- **خادم API:** مسارات `app/api/*` (Route Handlers).
- **قاعدة البيانات:** Cloud Firestore، مع عزل كامل بالـ `tenantId` على المستندات والاستعلامات.
- **حالة الطلب:** آلة حالات مركزية في `lib/logic/order-state-machine.ts`.
- **تكاملات:** WooCommerce (ويبهوك + REST)، Bosta، تمرير طلبات من واجهة المتجر (Storefront)، واتساب Cloud API للصندوق الوارد والأتمتة.

---

## المتطلبات والتشغيل المحلي

1. **Node.js** (يُفضّل الإصدار المتوافق مع المشروع؛ انظر `package.json`).
2. **مشروع Supabase** مع تفعيل Postgres وAuthentication.
3. نسخ ملف البيئة:

   ```bash
   cp .env.example .env.local
   ```

4. تعبئة المتغيرات الأساسية:
   - `SUPABASE_URL` و`SUPABASE_ANON_KEY` و`SUPABASE_SERVICE_ROLE_KEY`.
   - `NEXT_PUBLIC_SUPABASE_URL` و`NEXT_PUBLIC_SUPABASE_ANON_KEY` لعميل المتصفح.
   - `NEXT_PUBLIC_APP_URL`: رابط الموقع العام (مهم لروابط الويبهوك في الإنتاج).

5. التثبيت والتشغيل:

   ```bash
   npm install
   npm run dev
   ```

6. أوامر مفيدة:

   | الأمر | الوظيفة |
   |--------|---------|
   | `npm run dev` | خادم التطوير (Turbopack) |
   | `npm run build` | بناء إنتاجي |
   | `npm test` | اختبارات Vitest |
   | `npm run lint` | ESLint |

7. **وضع تجريبي بدون Firestore:** يمكن تعيين `DEV_MOCK_DATA=true` لاستخدام بيانات وهمية في الذاكرة (انظر الكود في `lib/dev/`).

---

## هيكلة المستودع

| المسار | الدور |
|--------|--------|
| `app/(app)/` | صفحات التطبيق بعد تسجيل الدخول (طلبات، إعدادات، مستودع، …) |
| `app/(marketing)/` | تسجيل الدخول والتسويق |
| `app/(platform)/` | لوحة super-admin للمنصة |
| `app/api/` | واجهات HTTP (طلبات، شحنات، ويبهوكات، إعدادات، …) |
| `lib/services/` | منطق الوصول لـ Firestore والخدمات |
| `lib/logic/` | آلة الحالات، قواعد الأتمتة، تعيين حالات WooCommerce |
| `lib/integrations/` | عملاء WooCommerce و Bosta |
| `lib/auth/` | سياق الطلب، RBAC |
| `store/zustand/` | حالة الواجهة والجلسة (تجارب محلية) |
| `docs/` | وثائق إضافية و ADR |
| `firestore.indexes.json` | فهارس مركّبة لـ Firestore |

قرار معماري موجز: [docs/adr/0001-architecture.md](./adr/0001-architecture.md).

---

## المصادقة والأدوار

- **موظفون (متصفح):** عادة Firebase ID Token، أو مفتاح `staffApiKey` لكل شركة في ترويسة `Authorization: Bearer …` مع `X-Tenant-Id`, `X-User-Id`, `X-User-Role` (تفاصيل في `lib/auth/context.ts`).
- **عزل المستأجر:** كل استعلام/كتابة تمر عبر خدمات تفرض `tenantId`.
- **الصلاحيات:** مصفوفة في `lib/auth/rbac.ts` (مثل `order:read`, `page:settings`, `user:manage`, `inbox:write`).
- **وضع صارم:** `STAFF_AUTH_MODE=firebase` مع إعداد Admin يقيّد المسارات على رموز Firebase فقط.

إعدادات التكاملات الحساسة (واتساب، Woo، Bosta) تتطلب عادة `page:settings` و`user:manage`.

---

## البيانات في Firestore

- **`tenant_settings/{tenantId}`:** تكاملات (`integrations`) وأتمتة (`automation`) وقوالب واتساب للتأكيد، إلخ.
- **الطلبات والشحنات والتذاكر:** كلها مرتبطة بـ `tenantId`.

مراجع:

- [docs/data-model.md](./data-model.md)
- [docs/database-usage.md](./database-usage.md)
- [docs/chat-data-model.md](./chat-data-model.md)

---

## تدفق الطلبات والويبهوكات

- **WooCommerce:** `POST /api/webhooks/woocommerce?tenant=<slug أو id>` مع تحقق HMAC (سر لكل شركة أو `WOOCOMMERCE_WEBHOOK_SECRET` على الخادم).
- **Storefront:** تمرير JSON الطلب إلى `/api/webhooks/storefront-orders?tenant=…`.
- **مزامنة الحالة إلى Woo:** عند تغيير حالة الطلب في الـ OMS يتم استدعاء REST Woo إن وُجدت مفاتيح في الإعدادات.

تفاصيل الاستيعاب والسجلات:

- [docs/webhook-ingestion.md](./webhook-ingestion.md)
- [docs/orders-workflow.md](./orders-workflow.md)

---

## ربط واتساب (WhatsApp Cloud API) — خطوة بخطوة

### أ) في Meta (Facebook Developers)

1. أنشئ **تطبيق Meta** من نوع Business، وأضف منتج **WhatsApp**.
2. من **WhatsApp → API Setup** احصل على:
   - **Phone number ID**
   - **WhatsApp Business Account ID** (اختياري لكن مفيد للتوثيق)
   - **Temporary access token** ثم أنشئ **System User** و**Long-lived token** للإنتاج (حسب سياسة Meta).
3. من إعدادات التطبيق انسخ **App secret** (للتحقق من توقيع الويبهوك `X-Hub-Signature-256`).

### ب) في الـ OMS — الإعدادات → API keys (تبويب التكاملات)

1. افتح **Settings → API keys** (قسم التكاملات).
2. في بطاقة **WhatsApp Cloud API**:
   - انسخ **Callback URL** المعروض (نفس النطاق العام للتطبيق + `?tenant=` للشركة).
   - اختر **Verify token** عشوائي قوي؛ احفظه في النموذج في الـ OMS و**نفس القيمة** في نموذج Meta عند إضافة الويبهوك.
   - الصق **Phone number ID** و**Access token** و(اختياري) **App secret** إذا لم تستخدم `WHATSAPP_APP_SECRET` على الخادم.
3. اضغط **Save WhatsApp Cloud**.

تُخزَّن القيم في Firestore تحت:

`tenant_settings/{tenantId}.integrations.whatsapp`

(الحقول: `verifyToken`, `accessToken`, `phoneNumberId`, `businessAccountId`, `appSecret`).

### ج) إكمال الويبهوك في Meta

1. **Callback URL:** كما يظهر في الإعدادات (مثال الشكل:  
   `https://your-domain.com/api/webhooks/whatsapp?tenant=your-tenant-slug`)
2. **Verify token:** مطابق لما حفظته في الـ OMS.
3. اشترك في الحقول **`messages`** و **`message_status`** (وأي حقول تحتاجها حسب التطبيق).

### د) متغيرات الخادم (موصى بها)

| المتغير | الغرض |
|---------|--------|
| `WHATSAPP_APP_SECRET` | سر التطبيق من Meta للتحقق من توقيع POST الويبهوك (إن لم تضع سراً لكل شركة في الإعدادات). |

تفاصيل تقنية إضافية: [docs/whatsapp-inbox.md](./whatsapp-inbox.md).

---

## أتمتة واتساب و n8n

بعد ضبط Cloud API:

1. في **Settings → Workspace** (قسم Shipment & confirmation / WhatsApp): فعّل **WhatsApp automation**، وعيّن قالب التأكيد المعتمد في Meta، واختيارياً رابط وسر **n8n**.
2. الأحداث والتوقيعات: [docs/n8n-whatsapp-automation.md](./n8n-whatsapp-automation.md).

متغيرات خادم شائعة: `AUTOMATION_SECRET`, `N8N_HMAC_SECRET`, `N8N_DEFAULT_WEBHOOK_URL` (انظر نفس الملفات والوثائق).

---

## الشحن (Bosta)

من **Integrations:** مفتاح API، عنوان API الاختياري، وقيم افتراضية للمدينة/المنطقة للعناوين. بدون مفتاح قد تُنشأ شحنات تجريبية.

---

## الإنتاج (مثلاً Vercel)

1. انسخ متغيرات البيئة إلى بيئة **Server** في المنصة (ليس فقط `.env.local`).
2. عيّن `NEXT_PUBLIC_APP_URL` إلى نطاقك الثابت `https://…` حتى تكون روابط الويبهوك صحيحة.
3. بعد تعديل `firestore.indexes.json` نفّذ نشر الفهارس:  
   `firebase deploy --only firestore:indexes` (بحساب لديه صلاحية المشروع).

---

## وثائق إضافية

- [whatsapp-inbox.md](./whatsapp-inbox.md) — صندوق الوارد والـ APIs
- [webhook-ingestion.md](./webhook-ingestion.md)
- [data-model.md](./data-model.md)
- [database-usage.md](./database-usage.md)
- [orders-workflow.md](./orders-workflow.md)

---

*آخر تحديث للدليل يتوافق مع إمكانية حفظ إعدادات واتساب من واجهة الإعدادات (Integrations) وليس يدوياً من Console فقط.*
