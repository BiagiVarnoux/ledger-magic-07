-- ================================================================
-- Migration 1: Multi-company (holding) schema
-- File: 20260528000001_multi_company_schema.sql
-- Date: 2026-05-28
--
-- Steps:
--   1.  Create `companies` table (no RLS)
--   2.  Create `company_members` table + RLS
--   3.  Seed company #1: Pia Gemer House
--   4.  Seed first existing user as owner of company #1
--   5.  Add nullable company_id FK to 19 data tables
--   6.  Backfill all existing rows → company #1 (zero data lost)
--   7.  Enforce NOT NULL on company_id across all 19 tables
--   8.  Fix sales.numero unique constraint → scoped per company
--   9.  Add performance indexes on company_id
--  10.  Rewrite RLS policies with company membership check
--
-- Tables intentionally excluded from company_id (inherit via FK):
--   journal_lines, sale_items, auxiliary_movement_details
-- ================================================================


-- ================================================================
-- STEP 1: companies (no RLS — access controlled via company_members)
-- ================================================================
CREATE TABLE public.companies (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text        NOT NULL,
  slug               text        NOT NULL UNIQUE,
  plan_cuentas_base  boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);


-- ================================================================
-- STEP 2: company_members + RLS
-- ================================================================
CREATE TABLE public.company_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('owner', 'accountant', 'viewer')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE INDEX idx_company_members_user    ON public.company_members(user_id);
CREATE INDEX idx_company_members_company ON public.company_members(company_id);

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own company memberships"
  ON public.company_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ================================================================
-- STEP 3: Seed first company
-- ================================================================
INSERT INTO public.companies (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Pia Gemer House', 'pia-gemer-house');


-- ================================================================
-- STEP 4: Seed the first existing user as owner of company #1
-- (ORDER BY created_at ensures deterministic selection)
-- ================================================================
INSERT INTO public.company_members (company_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', id, 'owner'
FROM auth.users
ORDER BY created_at
LIMIT 1;


-- ================================================================
-- STEP 5: Add nullable company_id to all data tables
-- ================================================================
ALTER TABLE public.accounts                     ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.audit_log                    ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.auxiliary_ledger             ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.auxiliary_ledger_definitions ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.cost_sheet_cells             ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.cost_sheets                  ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.import_lots                  ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.inventory_lots               ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.inventory_movements          ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.journal_entries              ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.kardex_definitions           ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.kardex_entries               ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.kardex_movements             ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.products                     ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.quarterly_closures           ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.report_settings              ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.sales                        ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.shipments                    ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.user_roles                   ADD COLUMN company_id uuid REFERENCES public.companies(id);


-- ================================================================
-- STEP 6: Backfill all existing rows → company #1
-- (WHERE company_id IS NULL is safe even on empty tables)
-- ================================================================
UPDATE public.accounts                     SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.audit_log                    SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.auxiliary_ledger             SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.auxiliary_ledger_definitions SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.cost_sheet_cells             SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.cost_sheets                  SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.import_lots                  SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.inventory_lots               SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.inventory_movements          SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.journal_entries              SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.kardex_definitions           SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.kardex_entries               SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.kardex_movements             SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.products                     SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.quarterly_closures           SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.report_settings              SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.sales                        SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.shipments                    SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.user_roles                   SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;


-- ================================================================
-- STEP 7: Enforce NOT NULL
-- ================================================================
ALTER TABLE public.accounts                     ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.audit_log                    ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.auxiliary_ledger             ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.auxiliary_ledger_definitions ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.cost_sheet_cells             ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.cost_sheets                  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.import_lots                  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.inventory_lots               ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.inventory_movements          ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.journal_entries              ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.kardex_definitions           ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.kardex_entries               ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.kardex_movements             ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.products                     ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.quarterly_closures           ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.report_settings              ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.sales                        ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.shipments                    ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.user_roles                   ALTER COLUMN company_id SET NOT NULL;


-- ================================================================
-- STEP 8: Fix sales.numero unique constraint → per-company scope
-- Original constraint name (migration 20260511014035): sales_numero_unique
-- ================================================================
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_numero_unique;
ALTER TABLE public.sales ADD CONSTRAINT sales_numero_company_unique UNIQUE (company_id, numero);


-- ================================================================
-- STEP 9: Performance indexes on company_id
-- The RLS subquery `company_id IN (SELECT company_id FROM
-- company_members WHERE user_id = auth.uid())` fires on every
-- row access; these indexes make it fast.
-- ================================================================
CREATE INDEX idx_accounts_company               ON public.accounts(company_id);
CREATE INDEX idx_audit_log_company              ON public.audit_log(company_id);
CREATE INDEX idx_auxiliary_ledger_company       ON public.auxiliary_ledger(company_id);
CREATE INDEX idx_aux_definitions_company        ON public.auxiliary_ledger_definitions(company_id);
CREATE INDEX idx_cost_sheets_company            ON public.cost_sheets(company_id);
CREATE INDEX idx_import_lots_company            ON public.import_lots(company_id);
CREATE INDEX idx_inventory_lots_company         ON public.inventory_lots(company_id);
CREATE INDEX idx_inventory_movements_company    ON public.inventory_movements(company_id);
CREATE INDEX idx_journal_entries_company        ON public.journal_entries(company_id);
CREATE INDEX idx_kardex_definitions_company     ON public.kardex_definitions(company_id);
CREATE INDEX idx_kardex_entries_company         ON public.kardex_entries(company_id);
CREATE INDEX idx_kardex_movements_company       ON public.kardex_movements(company_id);
CREATE INDEX idx_products_company               ON public.products(company_id);
CREATE INDEX idx_quarterly_closures_company     ON public.quarterly_closures(company_id);
CREATE INDEX idx_report_settings_company        ON public.report_settings(company_id);
CREATE INDEX idx_sales_company                  ON public.sales(company_id);
CREATE INDEX idx_shipments_company              ON public.shipments(company_id);
CREATE INDEX idx_user_roles_company             ON public.user_roles(company_id);


-- ================================================================
-- STEP 10: Rewrite RLS policies
--
-- New owner policy pattern:
--   USING (
--     auth.uid() = user_id
--     AND company_id IN (
--       SELECT cm.company_id FROM public.company_members cm
--       WHERE cm.user_id = auth.uid()
--     )
--   )
--
-- Viewer policies (has_shared_access) are preserved verbatim from
-- their original migrations — no structural change to viewer logic.
--
-- Tables with policy names confirmed from migration history use
-- named DROP POLICY. Tables whose CREATE TABLE was done outside
-- tracked migrations use a dynamic DO $$ block to safely drop all
-- existing policies before recreating.
-- ================================================================


-- ----------------------------------------------------------------
-- accounts
-- Owner policies: migration 20250814002353
-- Viewer policy:  migration 20251205032524
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "users_can_read_own_accounts"      ON public.accounts;
DROP POLICY IF EXISTS "users_can_create_own_accounts"    ON public.accounts;
DROP POLICY IF EXISTS "users_can_update_own_accounts"    ON public.accounts;
DROP POLICY IF EXISTS "users_can_delete_own_accounts"    ON public.accounts;
DROP POLICY IF EXISTS "viewers_can_read_shared_accounts" ON public.accounts;

CREATE POLICY "users_can_read_own_accounts" ON public.accounts
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "users_can_create_own_accounts" ON public.accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "users_can_update_own_accounts" ON public.accounts
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "users_can_delete_own_accounts" ON public.accounts
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "viewers_can_read_shared_accounts" ON public.accounts
  FOR SELECT
  USING (
    public.has_shared_access(auth.uid(), user_id)
    AND (
      SELECT can_view_accounts FROM public.shared_access
      WHERE viewer_id = auth.uid() AND owner_id = accounts.user_id LIMIT 1
    )
  );


-- ----------------------------------------------------------------
-- journal_entries
-- Owner policies: migration 20250814002353
-- Viewer policy:  migration 20251205032524
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "users_can_read_own_journal_entries"      ON public.journal_entries;
DROP POLICY IF EXISTS "users_can_create_own_journal_entries"    ON public.journal_entries;
DROP POLICY IF EXISTS "users_can_update_own_journal_entries"    ON public.journal_entries;
DROP POLICY IF EXISTS "users_can_delete_own_journal_entries"    ON public.journal_entries;
DROP POLICY IF EXISTS "viewers_can_read_shared_journal_entries" ON public.journal_entries;

CREATE POLICY "users_can_read_own_journal_entries" ON public.journal_entries
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "users_can_create_own_journal_entries" ON public.journal_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "users_can_update_own_journal_entries" ON public.journal_entries
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "users_can_delete_own_journal_entries" ON public.journal_entries
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "viewers_can_read_shared_journal_entries" ON public.journal_entries
  FOR SELECT
  USING (
    public.has_shared_access(auth.uid(), user_id)
    AND (
      SELECT can_view_journal FROM public.shared_access
      WHERE viewer_id = auth.uid() AND owner_id = journal_entries.user_id LIMIT 1
    )
  );


-- ----------------------------------------------------------------
-- auxiliary_ledger
-- Owner policies: migration 20250922142519
-- Viewer policy:  migration 20251205032524
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own auxiliary ledger entries"   ON public.auxiliary_ledger;
DROP POLICY IF EXISTS "Users can create their own auxiliary ledger entries" ON public.auxiliary_ledger;
DROP POLICY IF EXISTS "Users can update their own auxiliary ledger entries" ON public.auxiliary_ledger;
DROP POLICY IF EXISTS "Users can delete their own auxiliary ledger entries" ON public.auxiliary_ledger;
DROP POLICY IF EXISTS "viewers_can_read_shared_auxiliary_ledger"           ON public.auxiliary_ledger;

CREATE POLICY "Users can view their own auxiliary ledger entries" ON public.auxiliary_ledger
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can create their own auxiliary ledger entries" ON public.auxiliary_ledger
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can update their own auxiliary ledger entries" ON public.auxiliary_ledger
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can delete their own auxiliary ledger entries" ON public.auxiliary_ledger
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "viewers_can_read_shared_auxiliary_ledger" ON public.auxiliary_ledger
  FOR SELECT
  USING (
    public.has_shared_access(auth.uid(), user_id)
    AND (
      SELECT can_view_auxiliary FROM public.shared_access
      WHERE viewer_id = auth.uid() AND owner_id = auxiliary_ledger.user_id LIMIT 1
    )
  );


-- ----------------------------------------------------------------
-- auxiliary_ledger_definitions
-- Owner policies: migration 20251002011119
-- Viewer policy:  migration 20251205032524
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own auxiliary definitions"    ON public.auxiliary_ledger_definitions;
DROP POLICY IF EXISTS "Users can create their own auxiliary definitions"  ON public.auxiliary_ledger_definitions;
DROP POLICY IF EXISTS "Users can update their own auxiliary definitions"  ON public.auxiliary_ledger_definitions;
DROP POLICY IF EXISTS "Users can delete their own auxiliary definitions"  ON public.auxiliary_ledger_definitions;
DROP POLICY IF EXISTS "viewers_can_read_shared_auxiliary_definitions"    ON public.auxiliary_ledger_definitions;

CREATE POLICY "Users can view their own auxiliary definitions" ON public.auxiliary_ledger_definitions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can create their own auxiliary definitions" ON public.auxiliary_ledger_definitions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can update their own auxiliary definitions" ON public.auxiliary_ledger_definitions
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can delete their own auxiliary definitions" ON public.auxiliary_ledger_definitions
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "viewers_can_read_shared_auxiliary_definitions" ON public.auxiliary_ledger_definitions
  FOR SELECT
  USING (
    public.has_shared_access(auth.uid(), user_id)
    AND (
      SELECT can_view_auxiliary FROM public.shared_access
      WHERE viewer_id = auth.uid() AND owner_id = auxiliary_ledger_definitions.user_id LIMIT 1
    )
  );


-- ----------------------------------------------------------------
-- quarterly_closures
-- Owner policies: migration 20250925142435
-- Viewer policy:  migration 20251205032524
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own quarterly closures"   ON public.quarterly_closures;
DROP POLICY IF EXISTS "Users can create their own quarterly closures" ON public.quarterly_closures;
DROP POLICY IF EXISTS "Users can update their own quarterly closures" ON public.quarterly_closures;
DROP POLICY IF EXISTS "Users can delete their own quarterly closures" ON public.quarterly_closures;
DROP POLICY IF EXISTS "viewers_can_read_shared_quarterly_closures"   ON public.quarterly_closures;

CREATE POLICY "Users can view their own quarterly closures" ON public.quarterly_closures
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can create their own quarterly closures" ON public.quarterly_closures
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can update their own quarterly closures" ON public.quarterly_closures
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can delete their own quarterly closures" ON public.quarterly_closures
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "viewers_can_read_shared_quarterly_closures" ON public.quarterly_closures
  FOR SELECT
  USING (
    public.has_shared_access(auth.uid(), user_id)
    AND (
      SELECT can_view_reports FROM public.shared_access
      WHERE viewer_id = auth.uid() AND owner_id = quarterly_closures.user_id LIMIT 1
    )
  );


-- ----------------------------------------------------------------
-- audit_log
-- Owner policies: migration 20251213005407
-- Viewer policy:  migration 20251213005407
-- (audit_log has no UPDATE/DELETE owner policies by design)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own audit logs"   ON public.audit_log;
DROP POLICY IF EXISTS "Users can create their own audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "viewers_can_read_shared_audit_logs"   ON public.audit_log;

CREATE POLICY "Users can view their own audit logs" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can create their own audit logs" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "viewers_can_read_shared_audit_logs" ON public.audit_log
  FOR SELECT
  USING (
    has_shared_access(auth.uid(), user_id)
    AND (
      SELECT shared_access.can_view_journal FROM shared_access
      WHERE shared_access.viewer_id = auth.uid() AND shared_access.owner_id = audit_log.user_id LIMIT 1
    )
  );


-- ----------------------------------------------------------------
-- report_settings
-- Owner policies: migration 20260106223355
-- (no viewer policy exists for report_settings)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own report settings"   ON public.report_settings;
DROP POLICY IF EXISTS "Users can create their own report settings" ON public.report_settings;
DROP POLICY IF EXISTS "Users can update their own report settings" ON public.report_settings;
DROP POLICY IF EXISTS "Users can delete their own report settings" ON public.report_settings;

CREATE POLICY "Users can view their own report settings" ON public.report_settings
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can create their own report settings" ON public.report_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can update their own report settings" ON public.report_settings
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can delete their own report settings" ON public.report_settings
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );


-- ----------------------------------------------------------------
-- shipments
-- Owner + viewer policies: migration 20260309024716
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own shipments"   ON public.shipments;
DROP POLICY IF EXISTS "Users can create their own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can update their own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can delete their own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Viewers can read shared shipments"   ON public.shipments;

CREATE POLICY "Users can view their own shipments" ON public.shipments
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can create their own shipments" ON public.shipments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can update their own shipments" ON public.shipments
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Users can delete their own shipments" ON public.shipments
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "Viewers can read shared shipments" ON public.shipments
  FOR SELECT
  USING (
    has_shared_access(auth.uid(), user_id)
    AND (
      SELECT shared_access.can_view_auxiliary FROM shared_access
      WHERE shared_access.viewer_id = auth.uid() AND shared_access.owner_id = shipments.user_id LIMIT 1
    )
  );


-- ----------------------------------------------------------------
-- sales
-- Owner + viewer policies: migration 20260511014035
-- NOTE: the viewer policy uses can_view_auxiliary (original choice
-- by the project — preserved verbatim; see summary for discussion)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "users_can_read_own_sales"      ON public.sales;
DROP POLICY IF EXISTS "users_can_create_own_sales"    ON public.sales;
DROP POLICY IF EXISTS "users_can_update_own_sales"    ON public.sales;
DROP POLICY IF EXISTS "users_can_delete_own_sales"    ON public.sales;
DROP POLICY IF EXISTS "viewers_can_read_shared_sales" ON public.sales;

CREATE POLICY "users_can_read_own_sales" ON public.sales
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "users_can_create_own_sales" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "users_can_update_own_sales" ON public.sales
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "users_can_delete_own_sales" ON public.sales
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

CREATE POLICY "viewers_can_read_shared_sales" ON public.sales
  FOR SELECT
  USING (
    has_shared_access(auth.uid(), user_id)
    AND (
      SELECT shared_access.can_view_auxiliary FROM shared_access
      WHERE shared_access.viewer_id = auth.uid() AND shared_access.owner_id = sales.user_id LIMIT 1
    )
  );


-- ----------------------------------------------------------------
-- products, inventory_movements, inventory_lots, import_lots,
-- cost_sheets, user_roles
--
-- These tables were created via the Supabase dashboard; no
-- CREATE TABLE migration exists, so policy names are not confirmed.
-- We use a dynamic DO $$ block to drop ALL existing policies
-- safely before recreating with the new company_id check.
-- ----------------------------------------------------------------

-- products
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'products'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.products';
  END LOOP;
END $$;

CREATE POLICY "users_can_read_own_products" ON public.products
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_create_own_products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_update_own_products" ON public.products
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_delete_own_products" ON public.products
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

-- inventory_movements
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'inventory_movements'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.inventory_movements';
  END LOOP;
END $$;

CREATE POLICY "users_can_read_own_inventory_movements" ON public.inventory_movements
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_create_own_inventory_movements" ON public.inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_update_own_inventory_movements" ON public.inventory_movements
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_delete_own_inventory_movements" ON public.inventory_movements
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

-- inventory_lots
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'inventory_lots'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.inventory_lots';
  END LOOP;
END $$;

CREATE POLICY "users_can_read_own_inventory_lots" ON public.inventory_lots
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_create_own_inventory_lots" ON public.inventory_lots
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_update_own_inventory_lots" ON public.inventory_lots
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_delete_own_inventory_lots" ON public.inventory_lots
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

-- import_lots
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'import_lots'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.import_lots';
  END LOOP;
END $$;

CREATE POLICY "users_can_read_own_import_lots" ON public.import_lots
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_create_own_import_lots" ON public.import_lots
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_update_own_import_lots" ON public.import_lots
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_delete_own_import_lots" ON public.import_lots
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

-- cost_sheets
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'cost_sheets'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.cost_sheets';
  END LOOP;
END $$;

CREATE POLICY "users_can_read_own_cost_sheets" ON public.cost_sheets
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_create_own_cost_sheets" ON public.cost_sheets
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_update_own_cost_sheets" ON public.cost_sheets
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_delete_own_cost_sheets" ON public.cost_sheets
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );

-- user_roles
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'user_roles'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.user_roles';
  END LOOP;
END $$;

CREATE POLICY "users_can_read_own_user_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_create_own_user_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_update_own_user_roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "users_can_delete_own_user_roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
