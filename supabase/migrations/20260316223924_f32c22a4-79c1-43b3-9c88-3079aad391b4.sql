
CREATE OR REPLACE FUNCTION public.delete_inventory_movements_on_entry_delete()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.inventory_movements
  WHERE journal_entry_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_delete_inventory_movements_on_entry_delete
  BEFORE DELETE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_inventory_movements_on_entry_delete();
