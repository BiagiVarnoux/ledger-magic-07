-- Fix RLS policies to require authentication instead of public access
-- Drop existing permissive policies that allow public access
DROP POLICY IF EXISTS "dev read accounts" ON public.accounts;
DROP POLICY IF EXISTS "dev write accounts" ON public.accounts;
DROP POLICY IF EXISTS "dev update accounts" ON public.accounts;
DROP POLICY IF EXISTS "dev delete accounts" ON public.accounts;

DROP POLICY IF EXISTS "dev read je" ON public.journal_entries;
DROP POLICY IF EXISTS "dev write je" ON public.journal_entries;
DROP POLICY IF EXISTS "dev update je" ON public.journal_entries;
DROP POLICY IF EXISTS "dev delete je" ON public.journal_entries;

DROP POLICY IF EXISTS "dev read jl" ON public.journal_lines;
DROP POLICY IF EXISTS "dev write jl" ON public.journal_lines;
DROP POLICY IF EXISTS "dev update jl" ON public.journal_lines;
DROP POLICY IF EXISTS "dev delete jl" ON public.journal_lines;

-- Create secure RLS policies that require authentication
-- Accounts table policies
CREATE POLICY "authenticated_users_can_read_accounts" 
ON public.accounts 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "authenticated_users_can_create_accounts" 
ON public.accounts 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "authenticated_users_can_update_accounts" 
ON public.accounts 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "authenticated_users_can_delete_accounts" 
ON public.accounts 
FOR DELETE 
TO authenticated 
USING (true);

-- Journal entries table policies
CREATE POLICY "authenticated_users_can_read_journal_entries" 
ON public.journal_entries 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "authenticated_users_can_create_journal_entries" 
ON public.journal_entries 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "authenticated_users_can_update_journal_entries" 
ON public.journal_entries 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "authenticated_users_can_delete_journal_entries" 
ON public.journal_entries 
FOR DELETE 
TO authenticated 
USING (true);

-- Journal lines table policies
CREATE POLICY "authenticated_users_can_read_journal_lines" 
ON public.journal_lines 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "authenticated_users_can_create_journal_lines" 
ON public.journal_lines 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "authenticated_users_can_update_journal_lines" 
ON public.journal_lines 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "authenticated_users_can_delete_journal_lines" 
ON public.journal_lines 
FOR DELETE 
TO authenticated 
USING (true);