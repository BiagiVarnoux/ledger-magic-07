-- Remove the dangerous public read policy
DROP POLICY IF EXISTS "Anyone can view valid unused codes" ON public.invitation_codes;

-- Create a secure function to validate and redeem invitation codes
-- This function uses SECURITY DEFINER to bypass RLS and validate codes server-side
CREATE OR REPLACE FUNCTION public.redeem_invitation_code(
  _code TEXT,
  _user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code_data RECORD;
  _result jsonb;
BEGIN
  -- Find and validate the invitation code
  SELECT * INTO _code_data
  FROM public.invitation_codes
  WHERE code = _code
    AND used = false
    AND expires_at > now()
  LIMIT 1;

  -- If code doesn't exist or is invalid, return error
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Código de invitación inválido o expirado'
    );
  END IF;

  -- Mark code as used
  UPDATE public.invitation_codes
  SET used = true,
      used_by = _user_id
  WHERE id = _code_data.id;

  -- Create shared access record
  INSERT INTO public.shared_access (
    owner_id,
    viewer_id,
    can_view_accounts,
    can_view_journal,
    can_view_auxiliary,
    can_view_ledger,
    can_view_reports
  ) VALUES (
    _code_data.owner_id,
    _user_id,
    _code_data.can_view_accounts,
    _code_data.can_view_journal,
    _code_data.can_view_auxiliary,
    _code_data.can_view_ledger,
    _code_data.can_view_reports
  );

  -- Assign viewer role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'viewer'::app_role);

  -- Return success with permissions
  RETURN jsonb_build_object(
    'success', true,
    'permissions', jsonb_build_object(
      'can_view_accounts', _code_data.can_view_accounts,
      'can_view_journal', _code_data.can_view_journal,
      'can_view_auxiliary', _code_data.can_view_auxiliary,
      'can_view_ledger', _code_data.can_view_ledger,
      'can_view_reports', _code_data.can_view_reports
    )
  );
END;
$$;