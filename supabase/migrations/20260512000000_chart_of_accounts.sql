create type public.chart_account_type as enum ('asset', 'liability', 'equity', 'revenue', 'expense');

create table public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_id uuid references public.chart_of_accounts(id) on delete restrict,
  code varchar(20) not null,
  name text not null,
  name_ar text not null,
  account_type public.chart_account_type not null,
  is_system boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code),
  constraint chart_of_accounts_code_not_blank check (btrim(code) <> ''),
  constraint chart_of_accounts_name_not_blank check (btrim(name) <> ''),
  constraint chart_of_accounts_name_ar_not_blank check (btrim(name_ar) <> '')
);

create index chart_of_accounts_tenant_parent_idx on public.chart_of_accounts (tenant_id, parent_id, code);
create index chart_of_accounts_tenant_type_idx on public.chart_of_accounts (tenant_id, account_type, code);

create trigger chart_of_accounts_set_updated_at
before update on public.chart_of_accounts
for each row execute function app_private.set_updated_at();

alter table public.chart_of_accounts enable row level security;

create policy chart_of_accounts_access on public.chart_of_accounts
for all
using (app_private.can_access_tenant(tenant_id))
with check (app_private.can_access_tenant(tenant_id));

create or replace function app_private.seed_chart_of_accounts(seed_tenant_id uuid)
returns void
language plpgsql
as $$
declare
  assets_id uuid;
  liabilities_id uuid;
  equity_id uuid;
  revenue_id uuid;
  expenses_id uuid;
begin
  insert into public.chart_of_accounts (tenant_id, code, name, name_ar, account_type, is_system, notes)
  values
    (seed_tenant_id, '1000', 'Assets', 'الأصول', 'asset', true, 'Root asset accounts'),
    (seed_tenant_id, '2000', 'Liabilities', 'الالتزامات', 'liability', true, 'Root liability accounts'),
    (seed_tenant_id, '3000', 'Equity', 'حقوق الملكية', 'equity', true, 'Root equity accounts'),
    (seed_tenant_id, '4000', 'Revenue', 'الإيرادات', 'revenue', true, 'Root revenue accounts'),
    (seed_tenant_id, '5000', 'Expenses', 'المصروفات', 'expense', true, 'Root expense accounts')
  on conflict (tenant_id, code) do update
  set
    name = excluded.name,
    name_ar = excluded.name_ar,
    account_type = excluded.account_type,
    is_system = excluded.is_system,
    notes = excluded.notes;

  select id into assets_id from public.chart_of_accounts where tenant_id = seed_tenant_id and code = '1000';
  select id into liabilities_id from public.chart_of_accounts where tenant_id = seed_tenant_id and code = '2000';
  select id into equity_id from public.chart_of_accounts where tenant_id = seed_tenant_id and code = '3000';
  select id into revenue_id from public.chart_of_accounts where tenant_id = seed_tenant_id and code = '4000';
  select id into expenses_id from public.chart_of_accounts where tenant_id = seed_tenant_id and code = '5000';

  insert into public.chart_of_accounts (tenant_id, parent_id, code, name, name_ar, account_type, is_system, notes)
  values
    (seed_tenant_id, assets_id, '1100', 'Cash on Hand', 'النقدية بالخزينة', 'asset', true, 'Operational cash balance'),
    (seed_tenant_id, assets_id, '1200', 'Bank Accounts', 'حسابات البنوك', 'asset', true, 'Settlement and payout bank accounts'),
    (seed_tenant_id, assets_id, '1300', 'Accounts Receivable', 'العملاء وأوراق القبض', 'asset', true, 'Customer balances and receivables'),
    (seed_tenant_id, assets_id, '1400', 'Inventory', 'المخزون', 'asset', true, 'Stock and inventory value'),
    (seed_tenant_id, assets_id, '1500', 'COD Receivable', 'تحصيلات الدفع عند الاستلام', 'asset', true, 'Cash-on-delivery amounts pending from carriers'),
    (seed_tenant_id, liabilities_id, '2100', 'Accounts Payable', 'الموردون وأوراق الدفع', 'liability', true, 'Supplier and vendor payables'),
    (seed_tenant_id, liabilities_id, '2200', 'Carrier Payables', 'مستحقات شركات الشحن', 'liability', true, 'Carrier fees and balances'),
    (seed_tenant_id, liabilities_id, '2300', 'Tax Payable', 'ضرائب مستحقة', 'liability', true, 'Sales tax and VAT liabilities'),
    (seed_tenant_id, equity_id, '3100', 'Owner Capital', 'رأس المال', 'equity', true, 'Owner capital and contributions'),
    (seed_tenant_id, equity_id, '3200', 'Retained Earnings', 'أرباح محتجزة', 'equity', true, 'Accumulated retained earnings'),
    (seed_tenant_id, revenue_id, '4100', 'Product Sales', 'مبيعات المنتجات', 'revenue', true, 'Gross product sales'),
    (seed_tenant_id, revenue_id, '4200', 'Shipping Revenue', 'إيرادات الشحن', 'revenue', true, 'Shipping fees charged to customers'),
    (seed_tenant_id, revenue_id, '4300', 'Discounts and Returns', 'الخصومات والمرتجعات', 'revenue', true, 'Contra revenue for discounts, returns, and refunds'),
    (seed_tenant_id, expenses_id, '5100', 'Cost of Goods Sold', 'تكلفة البضاعة المباعة', 'expense', true, 'Product cost recognized on fulfilled orders'),
    (seed_tenant_id, expenses_id, '5200', 'Shipping Costs', 'تكلفة الشحن', 'expense', true, 'Carrier and shipping operation costs'),
    (seed_tenant_id, expenses_id, '5300', 'Return and Exchange Costs', 'تكلفة المرتجعات والاستبدالات', 'expense', true, 'Costs related to returns and exchanges'),
    (seed_tenant_id, expenses_id, '5400', 'Payment Processing Fees', 'رسوم معالجة المدفوعات', 'expense', true, 'Gateway and payment collection fees')
  on conflict (tenant_id, code) do update
  set
    parent_id = excluded.parent_id,
    name = excluded.name,
    name_ar = excluded.name_ar,
    account_type = excluded.account_type,
    is_system = excluded.is_system,
    notes = excluded.notes;
end;
$$;

create or replace function app_private.seed_chart_of_accounts_for_new_tenant()
returns trigger
language plpgsql
as $$
begin
  perform app_private.seed_chart_of_accounts(new.id);
  return new;
end;
$$;

create trigger tenants_seed_chart_of_accounts
after insert on public.tenants
for each row execute function app_private.seed_chart_of_accounts_for_new_tenant();

do $$
declare
  tenant_row record;
begin
  for tenant_row in select id from public.tenants loop
    perform app_private.seed_chart_of_accounts(tenant_row.id);
  end loop;
end;
$$;
