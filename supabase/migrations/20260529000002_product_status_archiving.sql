-- Product archiving system: three-state status column
-- Replaces the binary is_active flag with a richer status enum.

-- 1. Add status column with check constraint
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'activo'
  CHECK (status IN ('activo', 'archivado', 'descontinuado'));

-- 2. Migrate existing data
UPDATE public.products SET status = 'archivado' WHERE is_active = false;
UPDATE public.products SET status = 'activo'    WHERE is_active = true;

-- 3. Audit columns
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS archived_at     timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_reason text        NULL;

-- 4. Efficient index for operational filtering
CREATE INDEX IF NOT EXISTS idx_products_status_company
  ON public.products (company_id, status);

-- NOTE: is_active intentionally kept; will be dropped in a future migration
-- once all frontend queries have been verified to use status instead.
