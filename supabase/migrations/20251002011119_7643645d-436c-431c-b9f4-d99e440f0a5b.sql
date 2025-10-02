-- Create auxiliary_ledger_definitions table
CREATE TABLE public.auxiliary_ledger_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  account_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auxiliary_ledger_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own auxiliary definitions"
  ON public.auxiliary_ledger_definitions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own auxiliary definitions"
  ON public.auxiliary_ledger_definitions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auxiliary definitions"
  ON public.auxiliary_ledger_definitions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auxiliary definitions"
  ON public.auxiliary_ledger_definitions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add definition_id to auxiliary_ledger
ALTER TABLE public.auxiliary_ledger
  ADD COLUMN definition_id UUID REFERENCES public.auxiliary_ledger_definitions(id) ON DELETE CASCADE;