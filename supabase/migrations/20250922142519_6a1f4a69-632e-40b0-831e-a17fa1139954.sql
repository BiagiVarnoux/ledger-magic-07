-- Crear tabla para libros auxiliares
CREATE TABLE public.auxiliary_ledger (
  id text NOT NULL PRIMARY KEY,
  client_name text NOT NULL,
  account_id text NOT NULL,
  initial_amount numeric NOT NULL DEFAULT 0,  
  paid_amount numeric NOT NULL DEFAULT 0,
  total_balance numeric NOT NULL GENERATED ALWAYS AS (initial_amount - paid_amount) STORED,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.auxiliary_ledger ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS
CREATE POLICY "Users can view their own auxiliary ledger entries" 
ON public.auxiliary_ledger 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own auxiliary ledger entries" 
ON public.auxiliary_ledger 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auxiliary ledger entries" 
ON public.auxiliary_ledger 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auxiliary ledger entries" 
ON public.auxiliary_ledger 
FOR DELETE 
USING (auth.uid() = user_id);

-- Crear índices para mejor rendimiento
CREATE INDEX idx_auxiliary_ledger_user_id ON public.auxiliary_ledger(user_id);
CREATE INDEX idx_auxiliary_ledger_account_id ON public.auxiliary_ledger(account_id);
CREATE INDEX idx_auxiliary_ledger_client_name ON public.auxiliary_ledger(client_name);

-- Crear función para actualizar timestamp
CREATE OR REPLACE FUNCTION public.update_auxiliary_ledger_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Crear trigger para actualización automática de timestamp
CREATE TRIGGER update_auxiliary_ledger_updated_at
BEFORE UPDATE ON public.auxiliary_ledger
FOR EACH ROW
EXECUTE FUNCTION public.update_auxiliary_ledger_updated_at();