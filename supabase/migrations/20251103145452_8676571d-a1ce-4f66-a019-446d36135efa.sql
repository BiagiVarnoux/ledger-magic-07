-- Crear tabla para definiciones de Kárdex (similar a auxiliary_ledger_definitions)
CREATE TABLE IF NOT EXISTS public.kardex_definitions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  account_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, account_id)
);

-- Habilitar RLS en kardex_definitions
ALTER TABLE public.kardex_definitions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para kardex_definitions
CREATE POLICY "Users can view their own kardex definitions"
  ON public.kardex_definitions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own kardex definitions"
  ON public.kardex_definitions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own kardex definitions"
  ON public.kardex_definitions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own kardex definitions"
  ON public.kardex_definitions FOR DELETE
  USING (auth.uid() = user_id);

-- Agregar campo journal_entry_id a kardex_movements para vincular con asientos
ALTER TABLE public.kardex_movements 
ADD COLUMN IF NOT EXISTS journal_entry_id text;

-- Crear índice para mejorar rendimiento de búsquedas por journal_entry_id
CREATE INDEX IF NOT EXISTS idx_kardex_movements_journal_entry 
  ON public.kardex_movements(journal_entry_id);

-- Comentarios para documentar
COMMENT ON TABLE public.kardex_definitions IS 'Definiciones de Kárdex creadas manualmente por el usuario para cuentas específicas';
COMMENT ON COLUMN public.kardex_movements.journal_entry_id IS 'ID del asiento del libro diario al que está vinculado este movimiento (opcional, NULL para movimientos manuales)';