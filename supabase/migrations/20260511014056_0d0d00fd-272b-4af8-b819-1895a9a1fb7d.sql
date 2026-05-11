
REVOKE EXECUTE ON FUNCTION public.create_sale(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.void_sale(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_journal_entry_id(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sale(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_journal_entry_id(uuid, date) TO authenticated;
