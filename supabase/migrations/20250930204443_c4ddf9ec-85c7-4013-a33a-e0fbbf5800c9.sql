-- Create auxiliary_movement_details table for transactional tracking
CREATE TABLE public.auxiliary_movement_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aux_entry_id TEXT NOT NULL,
  journal_entry_id TEXT NOT NULL,
  movement_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('INCREASE', 'DECREASE')),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE public.auxiliary_movement_details
  ADD CONSTRAINT fk_aux_entry
  FOREIGN KEY (aux_entry_id) 
  REFERENCES public.auxiliary_ledger(id) 
  ON DELETE CASCADE;

ALTER TABLE public.auxiliary_movement_details
  ADD CONSTRAINT fk_journal_entry
  FOREIGN KEY (journal_entry_id) 
  REFERENCES public.journal_entries(id) 
  ON DELETE RESTRICT;

-- Create indexes for query optimization
CREATE INDEX idx_aux_movement_details_aux_entry ON public.auxiliary_movement_details(aux_entry_id);
CREATE INDEX idx_aux_movement_details_journal_entry ON public.auxiliary_movement_details(journal_entry_id);
CREATE INDEX idx_aux_movement_details_user ON public.auxiliary_movement_details(user_id);

-- Enable RLS
ALTER TABLE public.auxiliary_movement_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own auxiliary movement details"
  ON public.auxiliary_movement_details
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own auxiliary movement details"
  ON public.auxiliary_movement_details
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auxiliary movement details"
  ON public.auxiliary_movement_details
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auxiliary movement details"
  ON public.auxiliary_movement_details
  FOR DELETE
  USING (auth.uid() = user_id);