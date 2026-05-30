-- ─────────────────────────────────────────────────────────────────────────────
-- TAREA 1a: Tabla customers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.customers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid        NOT NULL,
  user_id             uuid        NOT NULL,
  codigo              text,
  razon_social        text        NOT NULL,
  nombre_corto        text,
  tipo                text        NOT NULL DEFAULT 'empresa'
                                  CHECK (tipo IN ('empresa','natural')),
  nit                 text,
  email               text,
  telefono            text,
  ciudad              text,
  credito_autorizado  numeric(18,2) NOT NULL DEFAULT 0,
  dias_credito        integer     NOT NULL DEFAULT 0,
  notas               text,
  activo              boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_company  ON public.customers(company_id);
CREATE INDEX idx_customers_user     ON public.customers(user_id, activo);
CREATE UNIQUE INDEX idx_customers_nit
  ON public.customers(company_id, nit)
  WHERE nit IS NOT NULL AND nit <> '';

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_owner_all" ON public.customers
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'customers_updated_at'
  ) THEN
    CREATE TRIGGER customers_updated_at
      BEFORE UPDATE ON public.customers
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TAREA 1b: FK customer_id en sales
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS customer_id uuid
    REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TAREA 1c: Función get_products_stock_batch
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_products_stock_batch(
  p_product_ids uuid[],
  p_user_id     uuid
)
RETURNS TABLE(
  product_id  uuid,
  stock       numeric,
  cpp         numeric,
  valor_total numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    product_id,
    COALESCE(SUM(
      CASE tipo
        WHEN 'ENTRADA' THEN cantidad
        WHEN 'SALIDA'  THEN -cantidad
        ELSE 0
      END
    ), 0) AS stock,
    CASE
      WHEN COALESCE(SUM(
        CASE tipo WHEN 'ENTRADA' THEN cantidad
                  WHEN 'SALIDA'  THEN -cantidad
                  ELSE 0 END), 0) > 0
      THEN ROUND(
        COALESCE(SUM(
          CASE tipo
            WHEN 'ENTRADA'      THEN  costo_total
            WHEN 'SALIDA'       THEN -costo_total
            WHEN 'AJUSTE_COSTO' THEN  costo_total
            ELSE 0
          END
        ), 0)
        /
        SUM(CASE tipo WHEN 'ENTRADA' THEN cantidad
                      WHEN 'SALIDA'  THEN -cantidad
                      ELSE 0 END)
      , 6)
      ELSE 0
    END AS cpp,
    COALESCE(SUM(
      CASE tipo
        WHEN 'ENTRADA'      THEN  costo_total
        WHEN 'SALIDA'       THEN -costo_total
        WHEN 'AJUSTE_COSTO' THEN  costo_total
        ELSE 0
      END
    ), 0) AS valor_total
  FROM public.inventory_movements
  WHERE product_id = ANY(p_product_ids)
    AND user_id = p_user_id
  GROUP BY product_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_products_stock_batch TO authenticated;
