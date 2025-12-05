-- Add RLS policies for viewers to see owner data

-- Accounts: viewers can read shared accounts
CREATE POLICY "viewers_can_read_shared_accounts" ON public.accounts
FOR SELECT USING (
  public.has_shared_access(auth.uid(), user_id)
  AND (SELECT can_view_accounts FROM public.shared_access WHERE viewer_id = auth.uid() AND owner_id = accounts.user_id LIMIT 1)
);

-- Journal entries: viewers can read shared entries
CREATE POLICY "viewers_can_read_shared_journal_entries" ON public.journal_entries
FOR SELECT USING (
  public.has_shared_access(auth.uid(), user_id)
  AND (SELECT can_view_journal FROM public.shared_access WHERE viewer_id = auth.uid() AND owner_id = journal_entries.user_id LIMIT 1)
);

-- Journal lines: viewers can read shared lines (through journal_entries ownership)
CREATE POLICY "viewers_can_read_shared_journal_lines" ON public.journal_lines
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_lines.entry_id
    AND public.has_shared_access(auth.uid(), je.user_id)
    AND (SELECT can_view_journal FROM public.shared_access WHERE viewer_id = auth.uid() AND owner_id = je.user_id LIMIT 1)
  )
);

-- Auxiliary ledger definitions: viewers can read shared definitions
CREATE POLICY "viewers_can_read_shared_auxiliary_definitions" ON public.auxiliary_ledger_definitions
FOR SELECT USING (
  public.has_shared_access(auth.uid(), user_id)
  AND (SELECT can_view_auxiliary FROM public.shared_access WHERE viewer_id = auth.uid() AND owner_id = auxiliary_ledger_definitions.user_id LIMIT 1)
);

-- Auxiliary ledger: viewers can read shared ledger entries
CREATE POLICY "viewers_can_read_shared_auxiliary_ledger" ON public.auxiliary_ledger
FOR SELECT USING (
  public.has_shared_access(auth.uid(), user_id)
  AND (SELECT can_view_auxiliary FROM public.shared_access WHERE viewer_id = auth.uid() AND owner_id = auxiliary_ledger.user_id LIMIT 1)
);

-- Auxiliary movement details: viewers can read shared movement details
CREATE POLICY "viewers_can_read_shared_auxiliary_movement_details" ON public.auxiliary_movement_details
FOR SELECT USING (
  public.has_shared_access(auth.uid(), user_id)
  AND (SELECT can_view_auxiliary FROM public.shared_access WHERE viewer_id = auth.uid() AND owner_id = auxiliary_movement_details.user_id LIMIT 1)
);

-- Kardex definitions: viewers can read shared kardex definitions
CREATE POLICY "viewers_can_read_shared_kardex_definitions" ON public.kardex_definitions
FOR SELECT USING (
  public.has_shared_access(auth.uid(), user_id)
  AND (SELECT can_view_auxiliary FROM public.shared_access WHERE viewer_id = auth.uid() AND owner_id = kardex_definitions.user_id LIMIT 1)
);

-- Kardex entries: viewers can read shared kardex entries
CREATE POLICY "viewers_can_read_shared_kardex_entries" ON public.kardex_entries
FOR SELECT USING (
  public.has_shared_access(auth.uid(), user_id)
  AND (SELECT can_view_auxiliary FROM public.shared_access WHERE viewer_id = auth.uid() AND owner_id = kardex_entries.user_id LIMIT 1)
);

-- Kardex movements: viewers can read shared kardex movements
CREATE POLICY "viewers_can_read_shared_kardex_movements" ON public.kardex_movements
FOR SELECT USING (
  public.has_shared_access(auth.uid(), user_id)
  AND (SELECT can_view_auxiliary FROM public.shared_access WHERE viewer_id = auth.uid() AND owner_id = kardex_movements.user_id LIMIT 1)
);

-- Quarterly closures: viewers can read shared quarterly closures
CREATE POLICY "viewers_can_read_shared_quarterly_closures" ON public.quarterly_closures
FOR SELECT USING (
  public.has_shared_access(auth.uid(), user_id)
  AND (SELECT can_view_reports FROM public.shared_access WHERE viewer_id = auth.uid() AND owner_id = quarterly_closures.user_id LIMIT 1)
);

-- Function to revoke shared access
CREATE OR REPLACE FUNCTION public.revoke_shared_access(_owner_id uuid, _viewer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete shared access record
  DELETE FROM public.shared_access
  WHERE owner_id = _owner_id AND viewer_id = _viewer_id;
  
  -- Check if viewer has any other shared access
  IF NOT EXISTS (SELECT 1 FROM public.shared_access WHERE viewer_id = _viewer_id) THEN
    -- Remove viewer role if no other access exists
    DELETE FROM public.user_roles WHERE user_id = _viewer_id AND role = 'viewer';
  END IF;
  
  RETURN true;
END;
$$;