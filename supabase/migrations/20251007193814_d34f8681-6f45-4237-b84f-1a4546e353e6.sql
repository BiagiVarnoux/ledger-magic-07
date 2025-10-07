-- Asignar rol 'owner' a todos los usuarios existentes que no tienen rol
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::public.app_role
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT (user_id) DO NOTHING;