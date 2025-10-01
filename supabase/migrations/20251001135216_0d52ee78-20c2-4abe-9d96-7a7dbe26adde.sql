-- Remove initial_amount and paid_amount columns from auxiliary_ledger as they are now calculated from movements
-- Use CASCADE to drop dependent columns like total_balance
ALTER TABLE public.auxiliary_ledger
  DROP COLUMN IF EXISTS initial_amount CASCADE,
  DROP COLUMN IF EXISTS paid_amount CASCADE;