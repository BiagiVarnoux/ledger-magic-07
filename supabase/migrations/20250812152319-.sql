-- ===============================
-- ESQUEMA EN ESPAÑOL (mínimo)
-- ===============================

-- Tipos permitidos (en español):
-- type: ACTIVO | PASIVO | PATRIMONIO | INGRESO | GASTO
-- normal_side: DEBE | HABER

create table if not exists public.accounts (
  id           text primary key,  -- ej: "A.1"
  name         text        not null,
  type         text        not null,
  normal_side  text        not null,
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  constraint accounts_type_es_chk
    check (type in ('ACTIVO','PASIVO','PATRIMONIO','INGRESO','GASTO')),
  constraint accounts_side_es_chk
    check (normal_side in ('DEBE','HABER'))
);

create table if not exists public.journal_entries (
  id         text primary key,  -- ej: "2025-08-00001" (lo genera el front)
  date       date not null,
  memo       text,
  void_of    text references public.journal_entries(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.journal_lines (
  id         bigserial primary key,
  entry_id   text not null references public.journal_entries(id) on delete cascade,
  account_id text not null references public.accounts(id),
  debit      numeric not null default 0,  -- DEBE
  credit     numeric not null default 0,  -- HABER
  line_memo  text
);

create index if not exists idx_jl_entry   on public.journal_lines(entry_id);
create index if not exists idx_jl_account on public.journal_lines(account_id);
create index if not exists idx_je_date    on public.journal_entries(date);

-- ===============================
-- POLÍTICAS RLS de desarrollo (abiertas solo para pruebas)
-- (En producción, las cambiaremos por tenant/auth)
-- ===============================
alter table public.accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='accounts') then
    create policy "dev read accounts"  on public.accounts for select using (true);
    create policy "dev write accounts" on public.accounts for insert with check (true);
    create policy "dev update accounts"on public.accounts for update using (true);
    create policy "dev delete accounts"on public.accounts for delete using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='journal_entries') then
    create policy "dev read je"  on public.journal_entries for select using (true);
    create policy "dev write je" on public.journal_entries for insert with check (true);
    create policy "dev update je"on public.journal_entries for update using (true);
    create policy "dev delete je"on public.journal_entries for delete using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='journal_lines') then
    create policy "dev read jl"  on public.journal_lines for select using (true);
    create policy "dev write jl" on public.journal_lines for insert with check (true);
    create policy "dev update jl"on public.journal_lines for update using (true);
    create policy "dev delete jl"on public.journal_lines for delete using (true);
  end if;
end $$;

-- ===============================
-- SEED (Plan de Cuentas en español con mis IDs)
-- ===============================
insert into public.accounts (id, name, type, normal_side, is_active) values
('A.1','Banco MN','ACTIVO','DEBE',true),
('A.2','Caja MN','ACTIVO','DEBE',true),
('A.3','Banco ME','ACTIVO','DEBE',true),
('A.4','Inventario','ACTIVO','DEBE',true),
('A.5','Cuentas por Cobrar','ACTIVO','DEBE',true),
('A.6','Crédito Fiscal IVA','ACTIVO','DEBE',true),
('A.7','USDT','ACTIVO','DEBE',true),
('G.1','Gastos Generales','GASTO','DEBE',true),
('G.2','Flete Aéreo','GASTO','DEBE',true),
('G.3','IT','GASTO','DEBE',true),
('G.4','Costo de Ventas','GASTO','DEBE',true),
('I.1','Ventas','INGRESO','HABER',true),
('P.1','Cuentas por Pagar','PASIVO','HABER',true),
('P.2','IT por Pagar','PASIVO','HABER',true),
('P.3','Débito Fiscal IVA','PASIVO','HABER',true),
('Pn.1','Capital','PATRIMONIO','HABER',true)
on conflict (id) do update
set name = excluded.name,
    type = excluded.type,
    normal_side = excluded.normal_side,
    is_active = excluded.is_active;