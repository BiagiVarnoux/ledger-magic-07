
-- Tabla de embarques
CREATE TABLE public.shipments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  numero text NOT NULL,
  status text NOT NULL DEFAULT 'EN_COMPRA',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own shipments"
  ON public.shipments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own shipments"
  ON public.shipments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipments"
  ON public.shipments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shipments"
  ON public.shipments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Viewers can read shared shipments"
  ON public.shipments FOR SELECT
  USING (
    has_shared_access(auth.uid(), user_id)
    AND (
      SELECT shared_access.can_view_auxiliary
      FROM shared_access
      WHERE shared_access.viewer_id = auth.uid()
        AND shared_access.owner_id = shipments.user_id
      LIMIT 1
    )
  );

-- Trigger updated_at
CREATE TRIGGER update_shipments_updated_at
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
