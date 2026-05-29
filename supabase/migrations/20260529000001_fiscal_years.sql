-- ================================================================
-- Migration: fiscal_years table
-- Date: 2026-05-29
--
-- Modelo: QuickBooks/Xero (Escuela 1) — sin asientos de cierre.
-- La separación entre gestiones se hace por cálculo dinámico en
-- reportes. Esta tabla solo persiste el estado OPEN/CLOSED y el
-- snapshot del resultado neto al momento del cierre.
--
-- Nota: la cuenta Pn.2 (Resultados Acumulados / PATRIMONIO) ya
-- existía en producción. No se inserta aquí. El helper
-- findUtilidadesAcumuladasAccount() la detecta por id='Pn.2' o
-- por nombre (incluye "resultados acumulados" y "utilidades acumuladas").
-- ================================================================

-- ================================================================
-- STEP 1: fiscal_years table
-- ================================================================
CREATE TABLE public.fiscal_years (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year                INTEGER     NOT NULL,
  start_date          DATE        NOT NULL,
  end_date            DATE        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  net_result_snapshot NUMERIC(18, 2),  -- resultado I-G al momento del cierre; inmutable tras cierre
  closed_at           TIMESTAMPTZ,
  closed_by           UUID        REFERENCES auth.users(id),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, year)
);

CREATE INDEX idx_fiscal_years_company_status ON public.fiscal_years(company_id, status);
CREATE INDEX idx_fiscal_years_dates          ON public.fiscal_years(start_date, end_date);

-- ================================================================
-- STEP 2: RLS — mismo patrón que el resto del esquema multi-company
-- ================================================================
ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_years_select"
  ON public.fiscal_years FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "fiscal_years_insert"
  ON public.fiscal_years FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'accountant')
    )
  );

CREATE POLICY "fiscal_years_update"
  ON public.fiscal_years FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'accountant')
    )
  );

CREATE POLICY "fiscal_years_delete"
  ON public.fiscal_years FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- ================================================================
-- STEP 3: updated_at trigger
-- ================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Only create trigger if it doesn't already exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'fiscal_years_updated_at'
  ) THEN
    CREATE TRIGGER fiscal_years_updated_at
      BEFORE UPDATE ON public.fiscal_years
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ================================================================
-- NOTE: Period lock is enforced in the frontend (useJournalForm.ts).
-- A database-level trigger on journal_entries for defense-in-depth
-- is deferred to a future PR. See TODO in useJournalForm.ts.
-- ================================================================
