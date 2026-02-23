
-- Phase 1: Advanced account classification columns
ALTER TABLE public.accounts 
  ADD COLUMN IF NOT EXISTS clasificacion_resultado text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subclasificacion_resultado text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS clasificacion_flujo text DEFAULT 'no_aplica',
  ADD COLUMN IF NOT EXISTS es_partida_no_monetaria boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS es_capital_trabajo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS es_financiera boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS es_extraordinaria boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS afecta_ebitda boolean DEFAULT true;

-- Auto-migrate existing expense_category data
UPDATE public.accounts SET clasificacion_resultado = 'costo_ventas' 
  WHERE expense_category = 'COSTO_VENTAS' AND clasificacion_resultado IS NULL;
UPDATE public.accounts SET clasificacion_resultado = 'gasto_operativo' 
  WHERE expense_category = 'GASTO_OPERATIVO' AND clasificacion_resultado IS NULL;
UPDATE public.accounts SET clasificacion_resultado = 'gasto_no_operativo' 
  WHERE expense_category = 'OTRO_GASTO' AND clasificacion_resultado IS NULL;
UPDATE public.accounts SET clasificacion_resultado = 'ingreso_operativo' 
  WHERE type = 'INGRESO' AND clasificacion_resultado IS NULL;
UPDATE public.accounts SET clasificacion_resultado = 'gasto_operativo' 
  WHERE type = 'GASTO' AND clasificacion_resultado IS NULL;

-- Auto-set clasificacion_flujo for cash accounts
UPDATE public.accounts SET clasificacion_flujo = 'operacion'
  WHERE is_cash_equivalent = true AND clasificacion_flujo = 'no_aplica';

-- Auto-set es_capital_trabajo for current assets/liabilities
UPDATE public.accounts SET es_capital_trabajo = true
  WHERE is_current = true AND type IN ('ACTIVO', 'PASIVO');
