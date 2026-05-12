# OMS data model (Firestore)

This document describes canonical entities, what lives in each document, and why we chose embedding vs separate collections.

## Tenants (`tenants`)

- **Purpose**: One merchant / company; `tenantId` scopes almost all queries.
- **لماذا**: عزل بيانات كل تاجر في الـ OMS متعدد المستأجرين.

## Orders (`orders`)

- **OMS lifecycle** is stored in `status` (same meaning as “omsStatus” in product language). **لماذا**: حقل واحد يقلل التكرار وتعارض الحقول.
- **`externalOrderId`**: Same value as WooCommerce order id for Woo-sourced rows; aligns with multi-source later. **`wooCommerceOrderId`** kept for backward compatibility.
- **`source`**: e.g. `"woocommerce"`. **لماذا**: نميز مصدر الطلب بدون افتراض Woo فقط في المستقبل.
- **`lastSyncedAt`**: Last successful ingest/sync from the source. **لماذا**: مراقبة التزامن واستعلامات الدعم.
- **`lineItemCount`**: Denormalized count of line items. **لماذا**: عرض القوائم بدون تحميل `lineItems` الكاملة (توفير قراءة وتكلفة).
- **`customer`, `payment`, `shipping`**: Normalized snapshots at ingest/update. **لماذا**: الطلب يبقى مرجعاً تاريخياً حتى لو تغيّر العميل لاحقاً في المتجر.
- **`lineItems`**: Full snapshot on the order document for **detail** views; omitted from list queries via `select()`. **لماذا**: تقليل حجم استجابة قائمة الطلبات.
- **`woocommerceOrderSnapshot`**: Optional; default off. Raw payload may live under `orders/{orderId}/webhook_snapshots/{deliveryId}` when debugging is enabled. **لماذا**: الحمولات الكبيرة تبطئ القراءات والـ listeners.
- **`webhookPayloadRef`**: Optional pointer (e.g. subcollection path key) to stored raw payload. **لماذا**: نربط الطلب بالأصل للتصحيح دون تخزين JSON ضخم في نفس المستند.

### List vs detail

- **List / summary**: `OrderListSummary` — fields needed for tables, badges, and filters; no `lineItems`, no raw snapshot.
- **Detail**: `OrderDetail` / full `Order` — includes `lineItems` and optional snapshot reference.

## Shipments (`shipments`)

- **Purpose**: AWB / carrier state; `order_id` links to `orders`.
- **لماذا**: الشحن دورة مستقلة مع تتبع وحالات ناقل مختلفة عن `order.status`.

## Tickets (`tickets`)

- **Purpose**: Returns, exchanges, complaints; `order_id` links to orders.
- **لماذا**: فصل منطق الدعم عن مستند الطلب الأساسي.

## Users (`users`)

- **Purpose**: Staff accounts per tenant; roles drive RBAC.
- **لماذا**: تعيين الطلبات وتغيير الحالات يجب أن يمر عبر صلاحيات واضحة.

## Integrations (no separate `integrations` collection)

- **Source of truth**: `tenant_settings` (per tenant), including WooCommerce keys and automation.
- **لماذا**: الإعدادات نادرة التغيير ولا تحتاج استعلام عبر كل المستأجرين؛ تجنب تكرار مصدر الحقيقة.

## Customers (embedded, not a top-level collection in v1)

- **Pattern**: Customer data is snapshotted on each order.
- **لماذا**: أبسط للتنفيذ؛ فهرس `customer.email` / `customer.phone` موجود للبحث. يمكن لاحقاً إضافة `customers` لو احتجت عرضاً مركزياً.

## Activity (`activity_logs`)

- **Purpose**: Generic audit timeline (orders, shipments, tickets, users).
- **لماذا**: سجل موحّد للواجهات الحالية.

## Order events (`order_events`)

- **Purpose**: Append-only, order-scoped events for critical actions (ingest, status changes).
- **لماذا**: استعلام أخف من مسح `activity_logs` لكل نوع كيان؛ يدعم توسع التدقيق.

## Integration idempotency (`integration_events`)

- **Purpose**: One doc per `tenantId + source + deliveryId` for inbound webhooks.
- **لماذا**: منع معالجة مزدوجة لنفس التسليم من Woo.

## Webhook ingest logs (`webhook_ingest_logs`)

- **Purpose**: One row per HTTP attempt (success/failure/duplicate); diagnostics in Settings.
- **لماذا**: عزل محاولات الـ HTTP عن منطق الطلب نفسه.

## Related aggregates

- **`analytics_daily`**: Day buckets for dashboards (event-driven increments).
- **`tenant_order_stage_stats`**: Stage rollups for kanban-style metrics.

**لماذا**: تجنب تجميع كل الطلبات عند كل تحميل للوحة التحكم.
