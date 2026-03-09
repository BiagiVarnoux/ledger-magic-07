-- Normalizar inventory_movements para usar nomenclatura canónica
-- tipo: ENTRADA/SALIDA (mayúsculas)
-- metodo_valuacion: CPP/FIFO/UEPS (FIFO en lugar de PEPS)

ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_tipo_check;

ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_metodo_valuacion_check;

UPDATE public.inventory_movements
SET tipo = CASE
  WHEN UPPER(tipo) = 'ENTRADA' THEN 'ENTRADA'
  WHEN UPPER(tipo) = 'SALIDA' THEN 'SALIDA'
  ELSE tipo
END
WHERE UPPER(tipo) IN ('ENTRADA', 'SALIDA');

UPDATE public.inventory_movements
SET metodo_valuacion = CASE
  WHEN UPPER(metodo_valuacion) = 'PEPS' THEN 'FIFO'
  ELSE UPPER(metodo_valuacion)
END
WHERE UPPER(metodo_valuacion) IN ('PEPS', 'FIFO', 'CPP', 'UEPS');

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_tipo_check
  CHECK (tipo = ANY (ARRAY['ENTRADA'::text, 'SALIDA'::text]));

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_metodo_valuacion_check
  CHECK (metodo_valuacion = ANY (ARRAY['CPP'::text, 'FIFO'::text, 'UEPS'::text]));