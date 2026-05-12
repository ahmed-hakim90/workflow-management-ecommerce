# WooCommerce webhook ingestion

End-to-end flow for inbound WooCommerce order webhooks, validation, idempotency, and logging.

## Sequence

1. **HTTP POST** to `/api/webhooks/woocommerce?tenant=...`
2. **Read raw body** as text (needed for HMAC).
3. **Verify** `X-WC-Webhook-Signature` with tenant (or fallback) secret. Failure → `401`, log outcome.
4. **Parse JSON**. Failure → `400`, log outcome.
5. **Idempotency claim** (`integration_events`): key = `tenantId + source + deliveryId`.  
   - `deliveryId` from `X-WC-Webhook-Delivery-Id` or stable hash fallback.  
   - If duplicate claim → `200` `{ duplicate: true }`, log **duplicate**, **لا إعادة كتابة الطلب**. **لماذا**: Woo قد يعيد إرسال نفس التسليم.
6. **Validate payload** with Zod (`woocommerce-map`). Failure → release claim (للسماح بإعادة المحاولة), `400`, log **failed**.
7. **Map** to OMS fields (customer, payment, line items, shipping, notes).
8. **Upsert order** by `tenantId` + `wooCommerceOrderId` / `externalOrderId`: create or update; payment may be **locked** after leaving `pending_confirmation`. **لماذا**: حماية مبالغ التأكيد بعد بدء التشغيل الداخلي.
9. **Optional raw payload**: If `WOOCOMMERCE_STORE_RAW_PAYLOAD=1`, store JSON under `orders/{orderId}/webhook_snapshots/{deliveryId}`; main order may store `webhookPayloadRef` only. **لماذا**: التخزين الافتراضي النحيف يحافظ على أداء القوائم والـ listeners.
10. **Append** `order_events` on meaningful ingest (and always on new create). **لماذا**: تدقيق منفصل عن `activity_logs` عند الحاجة.
11. **Webhook ingest log** with `receivedAt` / `processedAt`, `eventType` from `X-WC-Webhook-Topic` when present, normalized `status` for dashboards.

## Idempotency semantics

| Mechanism | Scope | Behavior |
|-----------|--------|----------|
| `integration_events` | One Woo **delivery** | Duplicate HTTP delivery → no re-processing |
| Order upsert key | `tenantId` + Woo order id | Same logical order updates one OMS document |

**لماذا**: طبقتان — منع تكرار الشبكة، ودمج تحديثات نفس الطلب من تسليمات مختلفة.

## Failure and retry

- On processing error **after** a successful claim, the handler calls `releaseIntegrationEventClaim` so WooCommerce can retry safely.
- **لماذا**: بدون الإفراج، التسليم يُعتبر “مستهلكاً” ولن يُعاد معالجته.

## Environment

- `WOOCOMMERCE_STORE_RAW_PAYLOAD` — set to `1` to persist raw JSON snapshots for debugging.
- `WOOCOMMERCE_WEBHOOK_SECRET` — optional fallback if tenant secret is unset.

## Storefront forwarding

`/api/webhooks/storefront-orders` follows the same upsert service; secrets and source differ; ingest logs use `storefront_order_forwarding`.
