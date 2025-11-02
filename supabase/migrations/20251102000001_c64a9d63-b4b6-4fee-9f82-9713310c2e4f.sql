-- Crear tabla para Kárdex con método Costo Promedio Ponderado
CREATE TABLE IF NOT EXISTS public.kardex_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Crear tabla para movimientos de kárdex (las 8 columnas)
CREATE TABLE IF NOT EXISTS public.kardex_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kardex_id UUID NOT NULL REFERENCES public.kardex_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  fecha DATE NOT NULL,
  concepto TEXT NOT NULL,
  entrada NUMERIC DEFAULT 0 NOT NULL,
  salidas NUMERIC DEFAULT 0 NOT NULL,
  saldo NUMERIC DEFAULT 0 NOT NULL,
  costo_unitario NUMERIC DEFAULT 0 NOT NULL,
  costo_total NUMERIC DEFAULT 0 NOT NULL,
  saldo_valorado NUMERIC DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.kardex_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kardex_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kardex_entries
CREATE POLICY "Users can view their own kardex entries"
ON public.kardex_entries FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own kardex entries"
ON public.kardex_entries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own kardex entries"
ON public.kardex_entries FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own kardex entries"
ON public.kardex_entries FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- RLS Policies for kardex_movements
CREATE POLICY "Users can view their own kardex movements"
ON public.kardex_movements FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own kardex movements"
ON public.kardex_movements FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own kardex movements"
ON public.kardex_movements FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own kardex movements"
ON public.kardex_movements FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_kardex_entries_user_account ON public.kardex_entries(user_id, account_id);
CREATE INDEX idx_kardex_movements_kardex ON public.kardex_movements(kardex_id, fecha);
CREATE INDEX idx_kardex_movements_user ON public.kardex_movements(user_id);