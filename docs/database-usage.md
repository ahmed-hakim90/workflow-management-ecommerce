# Database usage and query patterns

Guidelines for reads, writes, pagination, indexes, and client listeners.

## Read paths

- **Order list**: Use `listOrdersPage` (cursor + limit). Loads **summary** fields via Firestore `select()` to avoid large nested payloads. **لماذا**: تقليل تكلفة القراءة ووقت الشبكة.
- **Order detail**: `getOrder` / `getOrderDetailBundle` — full document + shipments. **لماذا**: الصفحة تحتاج بنود الطلب والتفاصيل الكاملة مرة واحدة.
- **Dashboards**: Prefer `analytics_daily` and `tenant_order_stage_stats` over scanning `orders`. **لماذا**: التجميع المسبق يثبت تكلفة الاستعلام.

## Write paths

- **Status changes**: Go through `orders.service` transitions (state machine + RBAC on API). **لماذا**: لا نثق بتحديثات العميل للمبالغ المالية.
- **Partial updates**: Prefer `update()` for changed top-level fields instead of rewriting the whole order. **لماذا**: كتابات أصغر وتقليل احتمالية race على حقول لم تُمس.
- **Webhook ingest**: Upsert uses fingerprinting to skip redundant activity when payload normalized content is unchanged. **لماذا**: منع ضوضاء السجلات عند إعادة إرسال Woo لنفس البيانات.

## Pagination

- **Cursor**: Base64url-encoded `{ createdAt, id }` tied to `orderBy("createdAt","desc").orderBy(documentId,"desc")`.
- **Limits**: Default 25, max 50 per request (enforced in service). **لماذا**: حماية من صفحات ضخمة وحدود Firestore.

## Search

- `searchOrdersPage` may run multiple equality queries (id, `wooCommerceOrderId`, phone, email) and merge results. **Cost note**: حتى N قراءات متوازية؛ مناسب لحدود صفحة صغيرة؛ للبحث النصي الحر لاحقاً فكّر في أداة بحث خارجية أو حقول `searchKeys`.

## Composite indexes

Defined in [`firestore.indexes.json`](../firestore.indexes.json). Typical compounds:

| Collection        | Fields (order)                                      | Use case |
|-------------------|-----------------------------------------------------|----------|
| `orders`          | `tenantId` ASC, `updatedAt` DESC                    | Recent activity sorts |
| `orders`          | `tenantId` ASC, `createdAt` DESC                    | Default list / cursor |
| `orders`          | `tenantId` ASC, `status` ASC, `updatedAt` DESC      | Filter by status + sort |
| `orders`          | `tenantId` ASC, `assigned_to` ASC, `createdAt` DESC | Assignee inbox |
| `orders`          | `tenantId` ASC, `payment.payment_status` ASC, `createdAt` DESC | Payment filter |
| `orders`          | `tenantId` ASC, `wooCommerceOrderId` ASC            | Idempotency / lookup |
| `activity_logs`   | `tenantId`, `entityType`, `entityId`, `timestamp`   | Entity timeline |
| `webhook_ingest_logs` | `tenantId`, `createdAt` DESC                    | Recent webhook diagnostics |
| `order_events`    | `tenantId`, `orderId`, `createdAt` DESC           | Per-order audit stream (`order_events`) |

**لماذا**: Firestore يفرض فهرساً مركباً لأي استعلام يجمع `where` متعدد مع `orderBy` على حقول مختلفة.

New query shapes (e.g. ordering by `lastSyncedAt`) require new composite entries before deployment.

## Realtime listeners

- `NewOrderSubscriber` listens to **recent** orders with a **small** `limit` and filters by `pending_confirmation` where possible. **لماذا**: تجنب الاشتراك في مجموعة كاملة متنامية؛ المستندات النحيفة تقلل تكلفة التحديثات.

## Security

- Financial fields must only change through trusted server actions (`confirm`, etc.), not arbitrary client patches.
- **لماذا**: منع التلاعب بإجمالي الطلب أو حالة الدفع من المتصفح.
