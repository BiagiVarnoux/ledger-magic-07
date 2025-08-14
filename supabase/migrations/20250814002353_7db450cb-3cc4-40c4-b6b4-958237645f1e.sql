-- Add user_id columns to tables for proper data isolation
-- This ensures each user can only access their own financial data

-- Add user_id to accounts table
ALTER TABLE public.accounts 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to journal_entries table  
ALTER TABLE public.journal_entries 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing policies that allow access to all data
DROP POLICY IF EXISTS "authenticated_users_can_read_accounts" ON public.accounts;
DROP POLICY IF EXISTS "authenticated_users_can_create_accounts" ON public.accounts;
DROP POLICY IF EXISTS "authenticated_users_can_update_accounts" ON public.accounts;
DROP POLICY IF EXISTS "authenticated_users_can_delete_accounts" ON public.accounts;

DROP POLICY IF EXISTS "authenticated_users_can_read_journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "authenticated_users_can_create_journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "authenticated_users_can_update_journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "authenticated_users_can_delete_journal_entries" ON public.journal_entries;

DROP POLICY IF EXISTS "authenticated_users_can_read_journal_lines" ON public.journal_lines;
DROP POLICY IF EXISTS "authenticated_users_can_create_journal_lines" ON public.journal_lines;
DROP POLICY IF EXISTS "authenticated_users_can_update_journal_lines" ON public.journal_lines;
DROP POLICY IF EXISTS "authenticated_users_can_delete_journal_lines" ON public.journal_lines;

-- Create secure RLS policies with proper user isolation
-- Accounts table policies - users can only access their own accounts
CREATE POLICY "users_can_read_own_accounts" 
ON public.accounts 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "users_can_create_own_accounts" 
ON public.accounts 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_accounts" 
ON public.accounts 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_delete_own_accounts" 
ON public.accounts 
FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Journal entries table policies - users can only access their own entries
CREATE POLICY "users_can_read_own_journal_entries" 
ON public.journal_entries 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "users_can_create_own_journal_entries" 
ON public.journal_entries 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_journal_entries" 
ON public.journal_entries 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_delete_own_journal_entries" 
ON public.journal_entries 
FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Journal lines policies - users can only access lines for their own entries
CREATE POLICY "users_can_read_own_journal_lines" 
ON public.journal_lines 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.journal_entries 
    WHERE journal_entries.id = journal_lines.entry_id 
    AND journal_entries.user_id = auth.uid()
  )
);

CREATE POLICY "users_can_create_own_journal_lines" 
ON public.journal_lines 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.journal_entries 
    WHERE journal_entries.id = journal_lines.entry_id 
    AND journal_entries.user_id = auth.uid()
  )
);

CREATE POLICY "users_can_update_own_journal_lines" 
ON public.journal_lines 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.journal_entries 
    WHERE journal_entries.id = journal_lines.entry_id 
    AND journal_entries.user_id = auth.uid()
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.journal_entries 
    WHERE journal_entries.id = journal_lines.entry_id 
    AND journal_entries.user_id = auth.uid()
  )
);

CREATE POLICY "users_can_delete_own_journal_lines" 
ON public.journal_lines 
FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.journal_entries 
    WHERE journal_entries.id = journal_lines.entry_id 
    AND journal_entries.user_id = auth.uid()
  )
);