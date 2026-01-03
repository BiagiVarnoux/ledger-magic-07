-- Create products table (Product Catalog)
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  unidad_medida text NOT NULL DEFAULT 'unidad',
  categoria text,
  cuenta_inventario_id text,
  is_active boolean NOT NULL DEFAULT true,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, codigo)
);

-- Enable RLS on products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS policies for products
CREATE POLICY "Users can view their own products"
ON public.products FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own products"
ON public.products FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products"
ON public.products FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products"
ON public.products FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Viewers can read shared products"
ON public.products FOR SELECT
USING (
  has_shared_access(auth.uid(), user_id) AND (
    SELECT shared_access.can_view_auxiliary
    FROM shared_access
    WHERE shared_access.viewer_id = auth.uid() AND shared_access.owner_id = products.user_id
    LIMIT 1
  )
);

-- Create cost_sheets table (Hojas de Costeo)
CREATE TABLE public.cost_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  referencia_importacion text,
  status text NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'finalizada')),
  metadata jsonb DEFAULT '{}'::jsonb,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on cost_sheets
ALTER TABLE public.cost_sheets ENABLE ROW LEVEL SECURITY;

-- RLS policies for cost_sheets
CREATE POLICY "Users can view their own cost sheets"
ON public.cost_sheets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cost sheets"
ON public.cost_sheets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cost sheets"
ON public.cost_sheets FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cost sheets"
ON public.cost_sheets FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Viewers can read shared cost sheets"
ON public.cost_sheets FOR SELECT
USING (
  has_shared_access(auth.uid(), user_id) AND (
    SELECT shared_access.can_view_auxiliary
    FROM shared_access
    WHERE shared_access.viewer_id = auth.uid() AND shared_access.owner_id = cost_sheets.user_id
    LIMIT 1
  )
);

-- Create cost_sheet_cells table (Celdas de hojas de costeo)
CREATE TABLE public.cost_sheet_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.cost_sheets(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  col_index integer NOT NULL,
  value text,
  formula text,
  cell_type text NOT NULL DEFAULT 'text' CHECK (cell_type IN ('text', 'number', 'formula', 'header')),
  style jsonb DEFAULT '{}'::jsonb,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(sheet_id, row_index, col_index)
);

-- Enable RLS on cost_sheet_cells
ALTER TABLE public.cost_sheet_cells ENABLE ROW LEVEL SECURITY;

-- RLS policies for cost_sheet_cells (based on sheet ownership)
CREATE POLICY "Users can view their own cost sheet cells"
ON public.cost_sheet_cells FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.cost_sheets
    WHERE cost_sheets.id = cost_sheet_cells.sheet_id
    AND cost_sheets.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own cost sheet cells"
ON public.cost_sheet_cells FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cost_sheets
    WHERE cost_sheets.id = cost_sheet_cells.sheet_id
    AND cost_sheets.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own cost sheet cells"
ON public.cost_sheet_cells FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.cost_sheets
    WHERE cost_sheets.id = cost_sheet_cells.sheet_id
    AND cost_sheets.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own cost sheet cells"
ON public.cost_sheet_cells FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.cost_sheets
    WHERE cost_sheets.id = cost_sheet_cells.sheet_id
    AND cost_sheets.user_id = auth.uid()
  )
);

CREATE POLICY "Viewers can read shared cost sheet cells"
ON public.cost_sheet_cells FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.cost_sheets cs
    WHERE cs.id = cost_sheet_cells.sheet_id
    AND has_shared_access(auth.uid(), cs.user_id)
    AND (
      SELECT shared_access.can_view_auxiliary
      FROM shared_access
      WHERE shared_access.viewer_id = auth.uid() AND shared_access.owner_id = cs.user_id
      LIMIT 1
    )
  )
);

-- Create import_lots table (Lotes de Importación)
CREATE TABLE public.import_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid REFERENCES public.cost_sheets(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  cantidad numeric NOT NULL DEFAULT 0,
  costo_unitario numeric NOT NULL DEFAULT 0,
  costo_total numeric NOT NULL DEFAULT 0,
  numero_lote text,
  fecha_ingreso date NOT NULL DEFAULT CURRENT_DATE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on import_lots
ALTER TABLE public.import_lots ENABLE ROW LEVEL SECURITY;

-- RLS policies for import_lots
CREATE POLICY "Users can view their own import lots"
ON public.import_lots FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own import lots"
ON public.import_lots FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own import lots"
ON public.import_lots FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own import lots"
ON public.import_lots FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Viewers can read shared import lots"
ON public.import_lots FOR SELECT
USING (
  has_shared_access(auth.uid(), user_id) AND (
    SELECT shared_access.can_view_auxiliary
    FROM shared_access
    WHERE shared_access.viewer_id = auth.uid() AND shared_access.owner_id = import_lots.user_id
    LIMIT 1
  )
);

-- Create inventory_lots table (Inventario por Lotes para PEPS/UEPS)
CREATE TABLE public.inventory_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  import_lot_id uuid REFERENCES public.import_lots(id) ON DELETE SET NULL,
  fecha_ingreso date NOT NULL DEFAULT CURRENT_DATE,
  cantidad_inicial numeric NOT NULL DEFAULT 0,
  cantidad_disponible numeric NOT NULL DEFAULT 0,
  costo_unitario numeric NOT NULL DEFAULT 0,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on inventory_lots
ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory_lots
CREATE POLICY "Users can view their own inventory lots"
ON public.inventory_lots FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own inventory lots"
ON public.inventory_lots FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inventory lots"
ON public.inventory_lots FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own inventory lots"
ON public.inventory_lots FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Viewers can read shared inventory lots"
ON public.inventory_lots FOR SELECT
USING (
  has_shared_access(auth.uid(), user_id) AND (
    SELECT shared_access.can_view_auxiliary
    FROM shared_access
    WHERE shared_access.viewer_id = auth.uid() AND shared_access.owner_id = inventory_lots.user_id
    LIMIT 1
  )
);

-- Create inventory_movements table (Movimientos de Inventario)
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  inventory_lot_id uuid REFERENCES public.inventory_lots(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  cantidad numeric NOT NULL DEFAULT 0,
  costo_unitario numeric NOT NULL DEFAULT 0,
  costo_total numeric NOT NULL DEFAULT 0,
  metodo_valuacion text NOT NULL DEFAULT 'CPP' CHECK (metodo_valuacion IN ('CPP', 'PEPS', 'UEPS')),
  referencia text,
  journal_entry_id text,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on inventory_movements
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory_movements
CREATE POLICY "Users can view their own inventory movements"
ON public.inventory_movements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own inventory movements"
ON public.inventory_movements FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inventory movements"
ON public.inventory_movements FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own inventory movements"
ON public.inventory_movements FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Viewers can read shared inventory movements"
ON public.inventory_movements FOR SELECT
USING (
  has_shared_access(auth.uid(), user_id) AND (
    SELECT shared_access.can_view_auxiliary
    FROM shared_access
    WHERE shared_access.viewer_id = auth.uid() AND shared_access.owner_id = inventory_movements.user_id
    LIMIT 1
  )
);

-- Create triggers for updated_at columns
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cost_sheets_updated_at
BEFORE UPDATE ON public.cost_sheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();