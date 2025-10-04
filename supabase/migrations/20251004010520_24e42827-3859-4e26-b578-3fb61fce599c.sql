-- Create a trigger function to automatically delete auxiliary movement details
-- when a journal entry is deleted
CREATE OR REPLACE FUNCTION public.delete_auxiliary_movements_on_entry_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete all auxiliary movement details associated with the deleted journal entry
  DELETE FROM public.auxiliary_movement_details
  WHERE journal_entry_id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- Create the trigger on journal_entries table
CREATE TRIGGER trigger_delete_auxiliary_movements
AFTER DELETE ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.delete_auxiliary_movements_on_entry_delete();