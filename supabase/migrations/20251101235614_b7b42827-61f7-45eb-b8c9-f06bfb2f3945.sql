-- Fix 1: Make journal_entries.user_id NOT NULL
ALTER TABLE public.journal_entries 
ALTER COLUMN user_id SET NOT NULL;

-- Fix 2: Drop all old invitation_codes policies first
DROP POLICY IF EXISTS "Owners can view their invitation codes" ON public.invitation_codes;
DROP POLICY IF EXISTS "Owners can create invitation codes" ON public.invitation_codes;
DROP POLICY IF EXISTS "Owners can update their invitation codes" ON public.invitation_codes;
DROP POLICY IF EXISTS "Owners can delete their invitation codes" ON public.invitation_codes;

-- Create new role-based policy for invitation_codes
CREATE POLICY "Only owners can manage invitation codes"
ON public.invitation_codes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner') AND auth.uid() = owner_id)
WITH CHECK (public.has_role(auth.uid(), 'owner') AND auth.uid() = owner_id);

-- Fix 3: Drop all old shared_access policies first
DROP POLICY IF EXISTS "Owners can view their shared access" ON public.shared_access;
DROP POLICY IF EXISTS "Viewers can view their shared access" ON public.shared_access;
DROP POLICY IF EXISTS "Owners can create shared access" ON public.shared_access;
DROP POLICY IF EXISTS "Owners can update their shared access" ON public.shared_access;
DROP POLICY IF EXISTS "Owners can delete their shared access" ON public.shared_access;

-- Create new role-based policies for shared_access
CREATE POLICY "Only owners can manage shared access"
ON public.shared_access
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner') AND auth.uid() = owner_id)
WITH CHECK (public.has_role(auth.uid(), 'owner') AND auth.uid() = owner_id);

CREATE POLICY "Viewers can see their shared access"
ON public.shared_access
FOR SELECT
TO authenticated
USING (auth.uid() = viewer_id);