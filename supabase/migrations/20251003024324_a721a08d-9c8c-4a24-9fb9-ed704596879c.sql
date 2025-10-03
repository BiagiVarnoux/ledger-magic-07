-- Remove the foreign key constraint that prevents INITIAL_BALANCE entries
ALTER TABLE public.auxiliary_movement_details 
DROP CONSTRAINT IF EXISTS fk_journal_entry;

-- Optionally, add a check constraint to allow only valid journal_entry_id or 'INITIAL_BALANCE'
-- This ensures data integrity while allowing special initial balance entries
ALTER TABLE public.auxiliary_movement_details
ADD CONSTRAINT check_journal_entry_format 
CHECK (
  journal_entry_id = 'INITIAL_BALANCE' 
  OR journal_entry_id ~ '^[0-9]+-Q[1-4]-[0-9]{2}$'
);