create extension if not exists pgcrypto;

create schema if not exists app_private;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_profile_id uuid,
  staff_api_key text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_slugs (
  slug text primary key,
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text,
  name text not null default '',
  language text not null default 'en',
  role text not null check (role in ('admin', 'moderator', 'confirmation', 'invoicing', 'warehouse', 'support', 'viewer')),
  permissions text[] not null default '{}',
  daily_target integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenants add constraint tenants_owner_profile_id_fkey foreign key (owner_profile_id) references public.profiles(id) on delete set null;

create table public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  integrations jsonb not null default '{}'::jsonb,
  automation jsonb not null default '{}'::jsonb,
  kanban jsonb not null default '{}'::jsonb,
  outbound_webhooks jsonb not null default '[]'::jsonb,
  whatsapp jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer jsonb not null default '{}'::jsonb,
  payment jsonb not null default '{}'::jsonb,
  status text not null,
  status_updated_at timestamptz,
  invoice jsonb,
  shipment_ids uuid[] not null default '{}',
  assigned_to uuid references public.profiles(id) on delete set null,
  cancel_reason text,
  cancelled_at timestamptz,
  cancelled_by_user_id uuid references public.profiles(id) on delete set null,
  external_order_id text,
  source text,
  last_synced_at timestamptz,
  line_item_count integer not null default 0,
  webhook_payload_ref text,
  last_webhook_sync_fingerprint text,
  woocommerce_order_id text,
  latest_shipment_awb text,
  latest_shipment_carrier_tracking_status text,
  latest_shipment_status text,
  whatsapp_sent_at timestamptz,
  whatsapp_sent_by_user_id uuid references public.profiles(id) on delete set null,
  whatsapp_sent_by_user_name text,
  whatsapp_sent_phone text,
  shipping jsonb,
  notes text,
  woocommerce_order_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source, external_order_id),
  unique (tenant_id, woocommerce_order_id)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text,
  variation_id text,
  name text not null,
  sku text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null default 0,
  unit_cost numeric(12, 2),
  line_cost numeric(12, 2),
  product_url text,
  attributes jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  awb text not null,
  type text not null,
  status text not null,
  provider text not null,
  external_id text,
  carrier_tracking_status text,
  tracking_history jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, awb)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  type text not null,
  status text not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  shipment_ids uuid[] not null default '{}',
  subject text,
  description text,
  resolution jsonb,
  notes_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  user_id uuid references public.profiles(id) on delete set null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  type text not null,
  status_from text,
  status_to text,
  user_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.analytics_daily (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  date date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, date)
);

create table public.user_stats (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, profile_id, date)
);

create table public.tenant_order_stage_stats (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  stages jsonb not null default '{}'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  rebuilt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null default 'whatsapp',
  customer_phone text not null,
  customer_name text not null default '',
  linked_order_id uuid references public.orders(id) on delete set null,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  assigned_user_name text,
  status text not null,
  bot_enabled boolean not null default true,
  human_takeover boolean not null default false,
  unread_count integer not null default 0,
  has_unread boolean not null default false,
  last_message_text text not null default '',
  last_message_at timestamptz,
  tags text[] not null default '{}',
  department text,
  automation_paused_reason text,
  sla_first_response_due_at timestamptz,
  sla_resolution_due_at timestamptz,
  sla_breached_at timestamptz,
  sla_warning_sent_at timestamptz,
  sla_breached boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  direction text not null,
  channel text not null default 'whatsapp',
  type text not null,
  body text not null default '',
  whatsapp_message_id text,
  status text not null,
  sender_user_id uuid references public.profiles(id) on delete set null,
  customer_phone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, whatsapp_message_id)
);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  body text not null,
  event_key text,
  whatsapp_template_name text,
  category text,
  approval_status text,
  linked_oms_event text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whatsapp_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  phone_number_id text,
  outcome text not null,
  http_status integer not null,
  message_ids text[] not null default '{}',
  raw_body_truncated text,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.whatsapp_message_dedupe (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  whatsapp_message_id text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, whatsapp_message_id)
);

create table public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12, 2),
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '[]'::jsonb,
  support_tier text not null default 'standard',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_entitlements (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  package_id uuid references public.platform_packages(id) on delete set null,
  overrides jsonb not null default '{}'::jsonb,
  package_snapshot jsonb not null default '{}'::jsonb,
  assigned_by text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.oms_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null,
  aggregate_type text,
  aggregate_id text,
  payload jsonb not null default '{}'::jsonb,
  correlation_id text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null,
  status text not null,
  payload_summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.automation_dlq (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  error_message text not null,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.outbound_queue_dedupe (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  dedupe_key text not null,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, dedupe_key)
);

create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source text not null,
  delivery_id text not null,
  payload_hash text,
  created_at timestamptz not null default now(),
  unique (tenant_id, source, delivery_id)
);

create table public.webhook_ingest_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  source text not null,
  delivery_id text,
  outcome text not null,
  http_status integer,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.outbound_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  target_url text not null,
  event_type text not null,
  status text not null,
  http_status integer,
  payload jsonb not null default '{}'::jsonb,
  response_body text,
  created_at timestamptz not null default now()
);

create or replace function app_private.current_user_tenant_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.tenant_id from public.profiles p where p.user_id = auth.uid() and p.status = 'active'
$$;

create or replace function app_private.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid())
$$;

create or replace function app_private.can_access_tenant(target_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select target_tenant_id in (select app_private.current_user_tenant_ids()) or app_private.is_platform_admin()
$$;

create index profiles_tenant_id_created_at_idx on public.profiles (tenant_id, created_at desc);
create index orders_tenant_id_created_at_idx on public.orders (tenant_id, created_at desc);
create index orders_tenant_id_updated_at_idx on public.orders (tenant_id, updated_at desc);
create index orders_tenant_id_status_idx on public.orders (tenant_id, status);
create index orders_tenant_id_assigned_to_idx on public.orders (tenant_id, assigned_to);
create index orders_tenant_id_customer_phone_idx on public.orders (tenant_id, ((customer ->> 'phone')));
create index orders_tenant_id_customer_email_idx on public.orders (tenant_id, ((customer ->> 'email')));
create index order_items_tenant_id_order_id_idx on public.order_items (tenant_id, order_id);
create index shipments_tenant_id_created_at_idx on public.shipments (tenant_id, created_at desc);
create index shipments_tenant_id_status_idx on public.shipments (tenant_id, status);
create index shipments_tenant_id_order_id_idx on public.shipments (tenant_id, order_id);
create index tickets_tenant_id_created_at_idx on public.tickets (tenant_id, created_at desc);
create index tickets_tenant_id_status_idx on public.tickets (tenant_id, status);
create index activity_logs_tenant_entity_created_idx on public.activity_logs (tenant_id, entity_type, entity_id, created_at desc);
create index order_events_tenant_order_created_idx on public.order_events (tenant_id, order_id, created_at desc);
create index analytics_daily_tenant_date_idx on public.analytics_daily (tenant_id, date desc);
create index user_stats_tenant_profile_date_idx on public.user_stats (tenant_id, profile_id, date desc);
create index chat_conversations_tenant_last_message_idx on public.chat_conversations (tenant_id, last_message_at desc);
create index chat_conversations_tenant_status_idx on public.chat_conversations (tenant_id, status);
create index chat_conversations_tenant_unread_sla_idx on public.chat_conversations (tenant_id, has_unread, sla_first_response_due_at);
create index chat_messages_tenant_conversation_created_idx on public.chat_messages (tenant_id, conversation_id, created_at);
create index chat_messages_tenant_whatsapp_id_idx on public.chat_messages (tenant_id, whatsapp_message_id);
create index message_templates_tenant_updated_idx on public.message_templates (tenant_id, updated_at desc);
create index whatsapp_webhook_logs_tenant_created_idx on public.whatsapp_webhook_logs (tenant_id, created_at desc);
create index webhook_ingest_logs_tenant_created_idx on public.webhook_ingest_logs (tenant_id, created_at desc);
create index outbound_webhook_logs_tenant_created_idx on public.outbound_webhook_logs (tenant_id, created_at desc);
create index oms_events_tenant_occurred_idx on public.oms_events (tenant_id, occurred_at desc);
create index automation_runs_tenant_created_idx on public.automation_runs (tenant_id, created_at desc);
create index automation_dlq_tenant_created_idx on public.automation_dlq (tenant_id, created_at desc);

create trigger tenants_set_updated_at before update on public.tenants for each row execute function app_private.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function app_private.set_updated_at();
create trigger tenant_settings_set_updated_at before update on public.tenant_settings for each row execute function app_private.set_updated_at();
create trigger orders_set_updated_at before update on public.orders for each row execute function app_private.set_updated_at();
create trigger order_items_set_updated_at before update on public.order_items for each row execute function app_private.set_updated_at();
create trigger shipments_set_updated_at before update on public.shipments for each row execute function app_private.set_updated_at();
create trigger tickets_set_updated_at before update on public.tickets for each row execute function app_private.set_updated_at();
create trigger analytics_daily_set_updated_at before update on public.analytics_daily for each row execute function app_private.set_updated_at();
create trigger user_stats_set_updated_at before update on public.user_stats for each row execute function app_private.set_updated_at();
create trigger tenant_order_stage_stats_set_updated_at before update on public.tenant_order_stage_stats for each row execute function app_private.set_updated_at();
create trigger chat_conversations_set_updated_at before update on public.chat_conversations for each row execute function app_private.set_updated_at();
create trigger message_templates_set_updated_at before update on public.message_templates for each row execute function app_private.set_updated_at();
create trigger platform_admins_set_updated_at before update on public.platform_admins for each row execute function app_private.set_updated_at();
create trigger platform_packages_set_updated_at before update on public.platform_packages for each row execute function app_private.set_updated_at();
create trigger tenant_entitlements_set_updated_at before update on public.tenant_entitlements for each row execute function app_private.set_updated_at();
create trigger automation_dlq_set_updated_at before update on public.automation_dlq for each row execute function app_private.set_updated_at();

alter table public.tenants enable row level security;
alter table public.tenant_slugs enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.shipments enable row level security;
alter table public.tickets enable row level security;
alter table public.activity_logs enable row level security;
alter table public.order_events enable row level security;
alter table public.analytics_daily enable row level security;
alter table public.user_stats enable row level security;
alter table public.tenant_order_stage_stats enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.message_templates enable row level security;
alter table public.whatsapp_webhook_logs enable row level security;
alter table public.whatsapp_message_dedupe enable row level security;
alter table public.platform_admins enable row level security;
alter table public.platform_packages enable row level security;
alter table public.tenant_entitlements enable row level security;
alter table public.oms_events enable row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_dlq enable row level security;
alter table public.outbound_queue_dedupe enable row level security;
alter table public.integration_events enable row level security;
alter table public.webhook_ingest_logs enable row level security;
alter table public.outbound_webhook_logs enable row level security;

create policy tenants_access on public.tenants for all using (app_private.can_access_tenant(id)) with check (app_private.can_access_tenant(id));
create policy tenant_slugs_access on public.tenant_slugs for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy profiles_access on public.profiles for all using (app_private.can_access_tenant(tenant_id) or user_id = auth.uid()) with check (app_private.can_access_tenant(tenant_id) or user_id = auth.uid());
create policy tenant_settings_access on public.tenant_settings for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy orders_access on public.orders for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy order_items_access on public.order_items for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy shipments_access on public.shipments for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy tickets_access on public.tickets for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy activity_logs_access on public.activity_logs for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy order_events_access on public.order_events for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy analytics_daily_access on public.analytics_daily for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy user_stats_access on public.user_stats for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy tenant_order_stage_stats_access on public.tenant_order_stage_stats for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy chat_conversations_access on public.chat_conversations for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy chat_messages_access on public.chat_messages for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy message_templates_access on public.message_templates for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy whatsapp_webhook_logs_access on public.whatsapp_webhook_logs for all using (tenant_id is null or app_private.can_access_tenant(tenant_id)) with check (tenant_id is null or app_private.can_access_tenant(tenant_id));
create policy whatsapp_message_dedupe_access on public.whatsapp_message_dedupe for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy platform_admins_access on public.platform_admins for all using (app_private.is_platform_admin()) with check (app_private.is_platform_admin());
create policy platform_packages_access on public.platform_packages for all using (app_private.is_platform_admin()) with check (app_private.is_platform_admin());
create policy tenant_entitlements_access on public.tenant_entitlements for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy oms_events_access on public.oms_events for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy automation_runs_access on public.automation_runs for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy automation_dlq_access on public.automation_dlq for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy outbound_queue_dedupe_access on public.outbound_queue_dedupe for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy integration_events_access on public.integration_events for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create policy webhook_ingest_logs_access on public.webhook_ingest_logs for all using (tenant_id is null or app_private.can_access_tenant(tenant_id)) with check (tenant_id is null or app_private.can_access_tenant(tenant_id));
create policy outbound_webhook_logs_access on public.outbound_webhook_logs for all using (app_private.can_access_tenant(tenant_id)) with check (app_private.can_access_tenant(tenant_id));
create extension if not exists pgcrypto;

create schema if not exists app_private;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_profile_id uuid,
  staff_api_key text,
  status text not null default 'active' check (status in ('active', 'suspended', 'disabled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_slugs (
  slug text primary key,
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text,
  name text not null default '',
  role text not null check (
    role in ('admin', 'moderator', 'confirmation', 'invoicing', 'warehouse', 'support', 'viewer')
  ),
  permissions text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenants
  add constraint tenants_owner_profile_id_fkey
  foreign key (owner_profile_id) references public.profiles(id) on delete set null;

create table public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  integrations jsonb not null default '{}'::jsonb,
  automation jsonb not null default '{}'::jsonb,
  kanban jsonb not null default '{}'::jsonb,
  outbound_webhooks jsonb not null default '[]'::jsonb,
  whatsapp jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer jsonb not null default '{}'::jsonb,
  payment jsonb not null default '{}'::jsonb,
  status text not null,
  status_updated_at timestamptz,
  invoice jsonb,
  shipment_ids uuid[] not null default '{}',
  assigned_to uuid references public.profiles(id) on delete set null,
  cancel_reason text,
  cancelled_at timestamptz,
  cancelled_by_user_id uuid references public.profiles(id) on delete set null,
  external_order_id text,
  source text,
  last_synced_at timestamptz,
  line_item_count integer not null default 0,
  webhook_payload_ref text,
  last_webhook_sync_fingerprint text,
  woocommerce_order_id text,
  latest_shipment_awb text,
  latest_shipment_carrier_tracking_status text,
  latest_shipment_status text,
  whatsapp_sent_at timestamptz,
  whatsapp_sent_by_user_id uuid references public.profiles(id) on delete set null,
  whatsapp_sent_by_user_name text,
  whatsapp_sent_phone text,
  shipping jsonb,
  notes text,
  woocommerce_order_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source, external_order_id),
  unique (tenant_id, woocommerce_order_id)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text,
  variation_id text,
  name text not null,
  sku text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null default 0,
  unit_cost numeric(12, 2),
  line_cost numeric(12, 2),
  product_url text,
  attributes jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  awb text not null,
  type text not null,
  status text not null,
  provider text not null,
  external_id text,
  service_code text,
  label_format text,
  label_url text,
  label_data text,
  thermal_label_url text,
  thermal_label_data text,
  carrier_account_ref text,
  raw_carrier_status text,
  cod_amount numeric(12, 2),
  allow_opening boolean,
  shipping_fees numeric(12, 2),
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_by_user_name text,
  carrier_tracking_status text,
  last_tracking_sync_at timestamptz,
  tracking_history jsonb not null default '[]'::jsonb,
  cancelled_at timestamptz,
  cancelled_by_user_id uuid references public.profiles(id) on delete set null,
  packed_at timestamptz,
  shipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, awb)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  type text not null,
  status text not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  shipment_ids uuid[] not null default '{}',
  subject text,
  description text,
  resolution jsonb,
  notes_history jsonb not null default '[]'::jsonb,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  user_id uuid references public.profiles(id) on delete set null,
  user_name text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  type text not null,
  status_from text,
  status_to text,
  user_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.analytics_daily (
  id text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  date date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, date)
);

create table public.user_stats (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, profile_id, date)
);

create table public.tenant_order_stage_stats (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  stages jsonb not null default '{}'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  rebuilt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null default 'whatsapp',
  customer_phone text not null,
  customer_name text not null default '',
  linked_order_id uuid references public.orders(id) on delete set null,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  assigned_user_name text,
  status text not null,
  bot_enabled boolean not null default true,
  human_takeover boolean not null default false,
  unread_count integer not null default 0,
  has_unread boolean not null default false,
  last_message_text text not null default '',
  last_message_at timestamptz,
  tags text[] not null default '{}',
  department text,
  automation_paused_reason text,
  sla_first_response_due_at timestamptz,
  sla_resolution_due_at timestamptz,
  sla_breached_at timestamptz,
  sla_warning_sent_at timestamptz,
  sla_breached boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  direction text not null,
  channel text not null default 'whatsapp',
  type text not null,
  body text not null default '',
  whatsapp_message_id text,
  status text not null,
  sender_user_id uuid references public.profiles(id) on delete set null,
  customer_phone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, whatsapp_message_id)
);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  body text not null,
  event_key text,
  whatsapp_template_name text,
  category text,
  approval_status text,
  linked_oms_event text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whatsapp_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  phone_number_id text,
  outcome text not null,
  http_status integer not null,
  message_ids text[] not null default '{}',
  raw_body_truncated text,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.whatsapp_message_dedupe (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  whatsapp_message_id text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, whatsapp_message_id)
);

create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source text not null,
  delivery_id text not null,
  payload_hash text,
  created_at timestamptz not null default now(),
  unique (tenant_id, source, delivery_id)
);

create table public.webhook_ingest_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  source text not null,
  delivery_id text,
  outcome text not null,
  http_status integer,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.outbound_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  target_url text not null,
  event_type text not null,
  status text not null,
  http_status integer,
  payload jsonb not null default '{}'::jsonb,
  response_body text,
  created_at timestamptz not null default now()
);

create table public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12, 2),
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_entitlements (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  package_id uuid references public.platform_packages(id) on delete set null,
  overrides jsonb not null default '{}'::jsonb,
  package_snapshot jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.oms_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null,
  aggregate_type text,
  aggregate_id text,
  payload jsonb not null default '{}'::jsonb,
  correlation_id text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null,
  status text not null,
  payload_summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.automation_dlq (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  error_message text not null,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.outbound_queue_dedupe (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, dedupe_key)
);

create or replace function app_private.current_user_tenant_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.tenant_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.status = 'active'
$$;

create or replace function app_private.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
  )
$$;

create or replace function app_private.can_access_tenant(target_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select target_tenant_id in (select app_private.current_user_tenant_ids())
    or app_private.is_platform_admin()
$$;

create index tenants_created_at_idx on public.tenants (created_at desc);
create index profiles_tenant_id_created_at_idx on public.profiles (tenant_id, created_at desc);
create index profiles_tenant_id_role_idx on public.profiles (tenant_id, role);
create index tenant_settings_updated_at_idx on public.tenant_settings (updated_at desc);
create index orders_tenant_id_created_at_idx on public.orders (tenant_id, created_at desc);
create index orders_tenant_id_updated_at_idx on public.orders (tenant_id, updated_at desc);
create index orders_tenant_id_status_idx on public.orders (tenant_id, status);
create index orders_tenant_id_assigned_to_idx on public.orders (tenant_id, assigned_to);
create index orders_tenant_id_customer_phone_idx on public.orders (tenant_id, ((customer ->> 'phone')));
create index orders_tenant_id_customer_email_idx on public.orders (tenant_id, ((customer ->> 'email')));
create index order_items_tenant_id_order_id_idx on public.order_items (tenant_id, order_id);
create index shipments_tenant_id_created_at_idx on public.shipments (tenant_id, created_at desc);
create index shipments_tenant_id_status_idx on public.shipments (tenant_id, status);
create index shipments_tenant_id_order_id_idx on public.shipments (tenant_id, order_id);
create index tickets_tenant_id_created_at_idx on public.tickets (tenant_id, created_at desc);
create index tickets_tenant_id_status_idx on public.tickets (tenant_id, status);
create index tickets_tenant_id_order_id_idx on public.tickets (tenant_id, order_id);
create index activity_logs_tenant_entity_created_idx on public.activity_logs (tenant_id, entity_type, entity_id, created_at desc);
create index order_events_tenant_order_created_idx on public.order_events (tenant_id, order_id, created_at desc);
create index order_events_tenant_created_idx on public.order_events (tenant_id, created_at desc);
create index analytics_daily_tenant_date_idx on public.analytics_daily (tenant_id, date desc);
create index user_stats_tenant_profile_date_idx on public.user_stats (tenant_id, profile_id, date desc);
create index chat_conversations_tenant_last_message_idx on public.chat_conversations (tenant_id, last_message_at desc);
create index chat_conversations_tenant_status_idx on public.chat_conversations (tenant_id, status);
create index chat_conversations_tenant_unread_sla_idx on public.chat_conversations (tenant_id, has_unread, sla_first_response_due_at);
create index chat_conversations_tenant_phone_idx on public.chat_conversations (tenant_id, customer_phone);
create index chat_messages_tenant_conversation_created_idx on public.chat_messages (tenant_id, conversation_id, created_at);
create index chat_messages_tenant_whatsapp_id_idx on public.chat_messages (tenant_id, whatsapp_message_id);
create index message_templates_tenant_updated_idx on public.message_templates (tenant_id, updated_at desc);
create index whatsapp_webhook_logs_tenant_created_idx on public.whatsapp_webhook_logs (tenant_id, created_at desc);
create index webhook_ingest_logs_tenant_created_idx on public.webhook_ingest_logs (tenant_id, created_at desc);
create index outbound_webhook_logs_tenant_created_idx on public.outbound_webhook_logs (tenant_id, created_at desc);
create index oms_events_tenant_occurred_idx on public.oms_events (tenant_id, occurred_at desc);
create index automation_runs_tenant_created_idx on public.automation_runs (tenant_id, created_at desc);
create index automation_dlq_tenant_created_idx on public.automation_dlq (tenant_id, created_at desc);

create trigger tenants_set_updated_at before update on public.tenants for each row execute function app_private.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function app_private.set_updated_at();
create trigger tenant_settings_set_updated_at before update on public.tenant_settings for each row execute function app_private.set_updated_at();
create trigger orders_set_updated_at before update on public.orders for each row execute function app_private.set_updated_at();
create trigger order_items_set_updated_at before update on public.order_items for each row execute function app_private.set_updated_at();
create trigger shipments_set_updated_at before update on public.shipments for each row execute function app_private.set_updated_at();
create trigger tickets_set_updated_at before update on public.tickets for each row execute function app_private.set_updated_at();
create trigger analytics_daily_set_updated_at before update on public.analytics_daily for each row execute function app_private.set_updated_at();
create trigger user_stats_set_updated_at before update on public.user_stats for each row execute function app_private.set_updated_at();
create trigger tenant_order_stage_stats_set_updated_at before update on public.tenant_order_stage_stats for each row execute function app_private.set_updated_at();
create trigger chat_conversations_set_updated_at before update on public.chat_conversations for each row execute function app_private.set_updated_at();
create trigger message_templates_set_updated_at before update on public.message_templates for each row execute function app_private.set_updated_at();
create trigger platform_admins_set_updated_at before update on public.platform_admins for each row execute function app_private.set_updated_at();
create trigger platform_packages_set_updated_at before update on public.platform_packages for each row execute function app_private.set_updated_at();
create trigger tenant_entitlements_set_updated_at before update on public.tenant_entitlements for each row execute function app_private.set_updated_at();
create trigger automation_dlq_set_updated_at before update on public.automation_dlq for each row execute function app_private.set_updated_at();

alter table public.tenants enable row level security;
alter table public.tenant_slugs enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.shipments enable row level security;
alter table public.tickets enable row level security;
alter table public.activity_logs enable row level security;
alter table public.order_events enable row level security;
alter table public.analytics_daily enable row level security;
alter table public.user_stats enable row level security;
alter table public.tenant_order_stage_stats enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.message_templates enable row level security;
alter table public.whatsapp_webhook_logs enable row level security;
alter table public.whatsapp_message_dedupe enable row level security;
alter table public.integration_events enable row level security;
alter table public.webhook_ingest_logs enable row level security;
alter table public.outbound_webhook_logs enable row level security;
alter table public.platform_admins enable row level security;
alter table public.platform_packages enable row level security;
alter table public.tenant_entitlements enable row level security;
alter table public.oms_events enable row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_dlq enable row level security;
alter table public.outbound_queue_dedupe enable row level security;

create policy tenants_tenant_access on public.tenants
  for all using (app_private.can_access_tenant(id))
  with check (app_private.can_access_tenant(id));

create policy tenant_slugs_tenant_access on public.tenant_slugs
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy profiles_tenant_access on public.profiles
  for all using (app_private.can_access_tenant(tenant_id) or user_id = auth.uid())
  with check (app_private.can_access_tenant(tenant_id) or user_id = auth.uid());

create policy tenant_settings_tenant_access on public.tenant_settings
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy orders_tenant_access on public.orders
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy order_items_tenant_access on public.order_items
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy shipments_tenant_access on public.shipments
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy tickets_tenant_access on public.tickets
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy activity_logs_tenant_access on public.activity_logs
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy order_events_tenant_access on public.order_events
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy analytics_daily_tenant_access on public.analytics_daily
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy user_stats_tenant_access on public.user_stats
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy tenant_order_stage_stats_tenant_access on public.tenant_order_stage_stats
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy chat_conversations_tenant_access on public.chat_conversations
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy chat_messages_tenant_access on public.chat_messages
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy message_templates_tenant_access on public.message_templates
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy whatsapp_webhook_logs_tenant_access on public.whatsapp_webhook_logs
  for all using (tenant_id is null or app_private.can_access_tenant(tenant_id))
  with check (tenant_id is null or app_private.can_access_tenant(tenant_id));

create policy whatsapp_message_dedupe_tenant_access on public.whatsapp_message_dedupe
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy integration_events_tenant_access on public.integration_events
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy webhook_ingest_logs_tenant_access on public.webhook_ingest_logs
  for all using (tenant_id is null or app_private.can_access_tenant(tenant_id))
  with check (tenant_id is null or app_private.can_access_tenant(tenant_id));

create policy outbound_webhook_logs_tenant_access on public.outbound_webhook_logs
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy platform_admins_admin_access on public.platform_admins
  for all using (app_private.is_platform_admin())
  with check (app_private.is_platform_admin());

create policy platform_packages_admin_access on public.platform_packages
  for all using (app_private.is_platform_admin())
  with check (app_private.is_platform_admin());

create policy tenant_entitlements_tenant_or_admin_access on public.tenant_entitlements
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy oms_events_tenant_access on public.oms_events
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy automation_runs_tenant_access on public.automation_runs
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy automation_dlq_tenant_access on public.automation_dlq
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));

create policy outbound_queue_dedupe_tenant_access on public.outbound_queue_dedupe
  for all using (app_private.can_access_tenant(tenant_id))
  with check (app_private.can_access_tenant(tenant_id));
