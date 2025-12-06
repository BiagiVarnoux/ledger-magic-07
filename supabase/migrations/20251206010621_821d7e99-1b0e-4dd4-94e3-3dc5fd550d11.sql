-- Fase 1: Eliminar el trigger que asigna owner automáticamente
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;

-- Fase 2: Actualizar la función redeem_invitation_code para manejar conflictos de rol
CREATE OR REPLACE FUNCTION public.redeem_invitation_code(_code text, _user_id uuid)
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

  -- Delete any existing roles for this user (in case trigger ran first)
  DELETE FROM public.user_roles WHERE user_id = _user_id;

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

-- Fase 3: Crear función para asignar rol owner por defecto (cuando no hay código de invitación)
CREATE OR REPLACE FUNCTION public.assign_default_owner_role(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert owner role, ignore if already exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'owner'::app_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;