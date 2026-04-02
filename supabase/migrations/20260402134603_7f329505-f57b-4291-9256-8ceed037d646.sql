
CREATE OR REPLACE FUNCTION public.assign_default_owner_role(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure the caller can only assign a role to themselves
  IF _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Insert owner role, ignore if already exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'owner'::app_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;
