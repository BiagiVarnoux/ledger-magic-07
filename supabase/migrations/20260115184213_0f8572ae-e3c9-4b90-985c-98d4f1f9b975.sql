-- Add classification columns to accounts table
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS expense_category text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_cash_equivalent boolean DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_current boolean;

-- Add constraint for expense_category values
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS valid_expense_category;
ALTER TABLE public.accounts ADD CONSTRAINT valid_expense_category 
  CHECK (expense_category IN ('COSTO_VENTAS', 'GASTO_OPERATIVO', 'OTRO_GASTO') OR expense_category IS NULL);