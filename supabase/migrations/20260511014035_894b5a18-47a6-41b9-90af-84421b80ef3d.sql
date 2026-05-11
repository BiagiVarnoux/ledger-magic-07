
-- =========================================
-- SALES MODULE: tables, RLS, RPCs
-- =========================================

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  numero text NOT NULL,
  fecha date NOT NULL,
  canal text NOT NULL,
  con_factura boolean NOT NULL DEFAULT false,
  tipo_pago text NOT NULL,
  cliente_nombre text,
  aux_entry_id uuid,
  glosa text,
  total_cobrado numeric(18,2) NOT NULL,
  total_iva numeric(18,2) NOT NULL DEFAULT 0,
  total_it numeric(18,2) NOT NULL DEFAULT 0,
  precio_neto_total numeric(18,2) NOT NULL,
  total_costo numeric(18,2),
  journal_entry_id text,
  estado text NOT NULL DEFAULT 'confirmed',
  void_reason text,
  void_journal_entry_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_numero_unique UNIQUE (numero),
  CONSTRAINT sales_estado_check CHECK (estado IN ('confirmed','voided')),
  CONSTRAINT sales_canal_check CHECK (canal IN ('licitacion','electronica','pedido','general'))
);

CREATE INDEX idx_sales_user ON public.sales(user_id);
CREATE INDEX idx_sales_fecha ON public.sales(fecha);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_read_own_sales" ON public.sales
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users_can_create_own_sales" ON public.sales
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_can_update_own_sales" ON public.sales
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_can_delete_own_sales" ON public.sales
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "viewers_can_read_shared_sales" ON public.sales
  FOR SELECT USING (
    has_shared_access(auth.uid(), user_id) AND (
      SELECT shared_access.can_view_auxiliary
      FROM shared_access
      WHERE shared_access.viewer_id = auth.uid() AND shared_access.owner_id = sales.user_id
      LIMIT 1
    )
  );

-- ---------- sale_items ----------
CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  product_nombre text NOT NULL,
  product_codigo text,
  cuenta_inventario_id text,
  metodo_valuacion text NOT NULL,
  cantidad numeric(18,4) NOT NULL,
  precio_unitario_neto numeric(18,4) NOT NULL,
  subtotal_neto numeric(18,2) NOT NULL,
  costo_unitario numeric(18,6),
  costo_total numeric(18,2),
  margen_bruto numeric(18,2),
  inventory_movement_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON public.sale_items(product_id);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_read_own_sale_items" ON public.sale_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.user_id = auth.uid())
  );
CREATE POLICY "users_can_create_own_sale_items" ON public.sale_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.user_id = auth.uid())
  );
CREATE POLICY "users_can_update_own_sale_items" ON public.sale_items
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.user_id = auth.uid())
  );
CREATE POLICY "users_can_delete_own_sale_items" ON public.sale_items
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.user_id = auth.uid())
  );
CREATE POLICY "viewers_can_read_shared_sale_items" ON public.sale_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND has_shared_access(auth.uid(), s.user_id)
        AND (
          SELECT shared_access.can_view_auxiliary FROM shared_access
          WHERE shared_access.viewer_id = auth.uid() AND shared_access.owner_id = s.user_id
          LIMIT 1
        )
    )
  );

-- =========================================
-- Helper: generate next journal entry ID for current quarter (per user)
-- =========================================
CREATE OR REPLACE FUNCTION public.next_journal_entry_id(p_user_id uuid, p_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_quarter int;
  v_qid text;
  v_max int := 0;
  v_seq int;
BEGIN
  v_year := to_char(p_date, 'YY');
  v_quarter := extract(quarter FROM p_date);
  v_qid := 'Q' || v_quarter || '-' || v_year;

  SELECT COALESCE(MAX((substring(id from '^(\d{3})-')::int)), 0)
    INTO v_max
    FROM public.journal_entries
   WHERE user_id = p_user_id
     AND id LIKE '%-' || v_qid;

  v_seq := v_max + 1;
  RETURN lpad(v_seq::text, 3, '0') || '-' || v_qid;
END;
$$;

-- =========================================
-- create_sale RPC
-- =========================================
CREATE OR REPLACE FUNCTION public.create_sale(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_fecha date := (payload->>'fecha')::date;
  v_canal text := payload->>'canal';
  v_con_factura boolean := COALESCE((payload->>'con_factura')::boolean, false);
  v_tipo_pago text := payload->>'tipo_pago';
  v_cliente text := payload->>'cliente_nombre';
  v_glosa text := payload->>'glosa';
  v_aux_entry_id uuid := NULLIF(payload->>'aux_entry_id','')::uuid;

  v_total_cobrado numeric(18,2) := (payload->>'total_cobrado')::numeric;
  v_total_iva numeric(18,2) := COALESCE((payload->>'total_iva')::numeric, 0);
  v_total_it numeric(18,2) := COALESCE((payload->>'total_it')::numeric, 0);
  v_precio_neto numeric(18,2) := (payload->>'precio_neto_total')::numeric;

  v_payment_account text := payload->>'payment_account';
  v_revenue_account text := payload->>'revenue_account';
  v_cogs_account text := payload->>'cogs_account';

  v_entry_id text;
  v_numero text;
  v_sale_id uuid := gen_random_uuid();

  v_item jsonb;
  v_product_id uuid;
  v_metodo text;
  v_cantidad numeric(18,4);
  v_precio_u numeric(18,4);
  v_subtotal numeric(18,2);
  v_cuenta_inv text;
  v_costo_u numeric(18,6);
  v_costo_t numeric(18,2);
  v_total_costo numeric(18,2) := 0;
  v_mov_id uuid;

  v_stock numeric;
  v_valor numeric;
  v_lot RECORD;
  v_remaining numeric;
  v_take numeric;

  v_inv_totals jsonb := '{}'::jsonb;
  v_account_id text;
  v_amount numeric;
  v_iva numeric;
  v_neto numeric;
  v_it numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF v_payment_account IS NULL OR v_revenue_account IS NULL OR v_cogs_account IS NULL THEN
    RAISE EXCEPTION 'Cuentas no resueltas';
  END IF;

  -- Step 1: generate IDs
  v_entry_id := public.next_journal_entry_id(v_user_id, v_fecha);
  v_numero := 'VTA-' || v_entry_id;

  -- Step 2: insert sale header (total_costo will be updated later)
  INSERT INTO public.sales (
    id, user_id, numero, fecha, canal, con_factura, tipo_pago, cliente_nombre,
    aux_entry_id, glosa, total_cobrado, total_iva, total_it, precio_neto_total,
    estado
  ) VALUES (
    v_sale_id, v_user_id, v_numero, v_fecha, v_canal, v_con_factura, v_tipo_pago, v_cliente,
    v_aux_entry_id, v_glosa, v_total_cobrado, v_total_iva, v_total_it, v_precio_neto,
    'confirmed'
  );

  -- Step 3: per item, resolve cost + insert inventory movement + sale_item
  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_metodo := v_item->>'metodo_valuacion';
    v_cantidad := (v_item->>'cantidad')::numeric;
    v_precio_u := (v_item->>'precio_unitario_neto')::numeric;
    v_subtotal := round((v_cantidad * v_precio_u)::numeric, 2);
    v_cuenta_inv := v_item->>'cuenta_inventario_id';

    IF v_metodo = 'CPP' THEN
      -- weighted average from movements
      SELECT
        COALESCE(SUM(CASE WHEN tipo='ENTRADA' THEN cantidad
                          WHEN tipo='SALIDA'  THEN -cantidad
                          ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo='ENTRADA' THEN costo_total
                          WHEN tipo='SALIDA'  THEN -costo_total
                          WHEN tipo='AJUSTE_COSTO' THEN costo_total
                          ELSE 0 END), 0)
        INTO v_stock, v_valor
        FROM public.inventory_movements
       WHERE product_id = v_product_id AND user_id = v_user_id;

      IF v_stock < v_cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para producto % (disponible %, solicitado %)',
          (v_item->>'product_nombre'), v_stock, v_cantidad;
      END IF;

      v_costo_u := CASE WHEN v_stock > 0 THEN round((v_valor / v_stock)::numeric, 6) ELSE 0 END;
      v_costo_t := round((v_costo_u * v_cantidad)::numeric, 2);

      v_mov_id := gen_random_uuid();
      INSERT INTO public.inventory_movements (
        id, product_id, tipo, cantidad, costo_unitario, costo_total,
        metodo_valuacion, referencia, journal_entry_id, fecha, user_id
      ) VALUES (
        v_mov_id, v_product_id, 'SALIDA', v_cantidad, v_costo_u, v_costo_t,
        'CPP', COALESCE(v_glosa, v_numero), v_entry_id, v_fecha, v_user_id
      );

    ELSIF v_metodo = 'FIFO' THEN
      v_remaining := v_cantidad;
      v_costo_t := 0;

      FOR v_lot IN
        SELECT id, cantidad_disponible, costo_unitario
          FROM public.inventory_lots
         WHERE product_id = v_product_id
           AND user_id = v_user_id
           AND cantidad_disponible > 0
         ORDER BY fecha_ingreso ASC, created_at ASC
      LOOP
        EXIT WHEN v_remaining <= 0;
        v_take := LEAST(v_remaining, v_lot.cantidad_disponible);

        UPDATE public.inventory_lots
           SET cantidad_disponible = cantidad_disponible - v_take
         WHERE id = v_lot.id;

        v_mov_id := gen_random_uuid();
        INSERT INTO public.inventory_movements (
          id, product_id, inventory_lot_id, tipo, cantidad, costo_unitario, costo_total,
          metodo_valuacion, referencia, journal_entry_id, fecha, user_id
        ) VALUES (
          v_mov_id, v_product_id, v_lot.id, 'SALIDA', v_take, v_lot.costo_unitario,
          round((v_take * v_lot.costo_unitario)::numeric, 2),
          'FIFO', COALESCE(v_glosa, v_numero), v_entry_id, v_fecha, v_user_id
        );

        v_costo_t := v_costo_t + round((v_take * v_lot.costo_unitario)::numeric, 2);
        v_remaining := v_remaining - v_take;
      END LOOP;

      IF v_remaining > 0 THEN
        RAISE EXCEPTION 'Stock FIFO insuficiente para producto % (faltan %)',
          (v_item->>'product_nombre'), v_remaining;
      END IF;

      v_costo_u := CASE WHEN v_cantidad > 0 THEN round((v_costo_t / v_cantidad)::numeric, 6) ELSE 0 END;
    ELSE
      RAISE EXCEPTION 'Método de valuación inválido: %', v_metodo;
    END IF;

    -- insert sale_item
    INSERT INTO public.sale_items (
      sale_id, product_id, product_nombre, product_codigo, cuenta_inventario_id,
      metodo_valuacion, cantidad, precio_unitario_neto, subtotal_neto,
      costo_unitario, costo_total, margen_bruto, inventory_movement_id
    ) VALUES (
      v_sale_id, v_product_id, v_item->>'product_nombre', v_item->>'product_codigo', v_cuenta_inv,
      v_metodo, v_cantidad, v_precio_u, v_subtotal,
      v_costo_u, v_costo_t, round((v_subtotal - v_costo_t)::numeric, 2), v_mov_id
    );

    v_total_costo := v_total_costo + v_costo_t;

    -- aggregate per inventory account
    IF v_cuenta_inv IS NOT NULL AND v_cuenta_inv <> '' THEN
      v_inv_totals := jsonb_set(
        v_inv_totals,
        ARRAY[v_cuenta_inv],
        to_jsonb(round((COALESCE((v_inv_totals->>v_cuenta_inv)::numeric, 0) + v_costo_t)::numeric, 2))
      );
    END IF;
  END LOOP;

  -- Step 4: insert journal entry
  INSERT INTO public.journal_entries (id, user_id, date, memo)
  VALUES (v_entry_id, v_user_id, v_fecha, COALESCE(v_glosa, v_numero));

  -- Step 5: insert journal lines
  IF NOT v_con_factura THEN
    -- Dr payment / Cr ventas
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_entry_id, v_payment_account, v_total_cobrado, 0, v_numero);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_entry_id, v_revenue_account, 0, v_total_cobrado, v_numero);
  ELSE
    -- Dr payment / Cr IVA + Cr ventas (net)
    v_iva := round((v_total_cobrado * 0.13)::numeric, 2);
    v_neto := round((v_total_cobrado - v_iva)::numeric, 2);
    v_it := round((v_total_cobrado * 0.03)::numeric, 2);

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_entry_id, v_payment_account, v_total_cobrado, 0, v_numero);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_entry_id, 'P.3', 0, v_iva, 'IVA Débito Fiscal ' || v_numero);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_entry_id, v_revenue_account, 0, v_neto, v_numero);
  END IF;

  -- Cost of sales: Dr cogs / Cr per inventory account
  IF v_total_costo > 0 THEN
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_entry_id, v_cogs_account, v_total_costo, 0, 'Costo ' || v_numero);

    FOR v_account_id, v_amount IN
      SELECT key, value::numeric FROM jsonb_each_text(v_inv_totals)
    LOOP
      INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
      VALUES (v_entry_id, v_account_id, 0, v_amount, 'Salida inventario ' || v_numero);
    END LOOP;
  END IF;

  -- IT lines if factura
  IF v_con_factura THEN
    v_it := round((v_total_cobrado * 0.03)::numeric, 2);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_entry_id, 'G.3', v_it, 0, 'IT ' || v_numero);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_entry_id, 'P.2', 0, v_it, 'IT por pagar ' || v_numero);
  END IF;

  -- Step 6: update sale totals
  UPDATE public.sales
     SET total_costo = v_total_costo,
         journal_entry_id = v_entry_id
   WHERE id = v_sale_id;

  RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id, 'numero', v_numero);
END;
$$;

-- =========================================
-- void_sale RPC
-- =========================================
CREATE OR REPLACE FUNCTION public.void_sale(p_sale_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sale RECORD;
  v_new_entry_id text;
  v_line RECORD;
  v_item RECORD;
  v_lot_exists boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;
  IF v_sale.estado = 'voided' THEN
    RAISE EXCEPTION 'La venta ya está anulada';
  END IF;
  IF v_sale.journal_entry_id IS NULL THEN
    RAISE EXCEPTION 'Venta sin asiento asociado';
  END IF;

  -- Step 1-2: new entry id + reversal entry
  v_new_entry_id := public.next_journal_entry_id(v_user_id, CURRENT_DATE);

  INSERT INTO public.journal_entries (id, user_id, date, memo, void_of)
  VALUES (
    v_new_entry_id, v_user_id, CURRENT_DATE,
    'Anulación ' || v_sale.numero || COALESCE(' — ' || p_reason, ''),
    v_sale.journal_entry_id
  );

  -- Step 3: copy lines with debit/credit swapped
  FOR v_line IN
    SELECT account_id, debit, credit, line_memo
      FROM public.journal_lines
     WHERE entry_id = v_sale.journal_entry_id
  LOOP
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_new_entry_id, v_line.account_id, v_line.credit, v_line.debit,
            'Anulación: ' || COALESCE(v_line.line_memo, ''));
  END LOOP;

  -- Step 4: restore inventory
  FOR v_item IN
    SELECT * FROM public.sale_items WHERE sale_id = p_sale_id
  LOOP
    -- restoring ENTRADA movement
    INSERT INTO public.inventory_movements (
      product_id, inventory_lot_id, tipo, cantidad, costo_unitario, costo_total,
      metodo_valuacion, referencia, journal_entry_id, fecha, user_id
    ) VALUES (
      v_item.product_id,
      CASE WHEN v_item.metodo_valuacion = 'FIFO' THEN
        (SELECT inventory_lot_id FROM public.inventory_movements WHERE id = v_item.inventory_movement_id)
      ELSE NULL END,
      'ENTRADA', v_item.cantidad, COALESCE(v_item.costo_unitario, 0), COALESCE(v_item.costo_total, 0),
      v_item.metodo_valuacion, 'Reversión ' || v_sale.numero, v_new_entry_id, CURRENT_DATE, v_user_id
    );

    -- FIFO: restore lot quantity
    IF v_item.metodo_valuacion = 'FIFO' THEN
      DECLARE
        v_orig_lot uuid;
      BEGIN
        SELECT inventory_lot_id INTO v_orig_lot
          FROM public.inventory_movements
         WHERE id = v_item.inventory_movement_id;

        IF v_orig_lot IS NOT NULL THEN
          SELECT EXISTS(SELECT 1 FROM public.inventory_lots WHERE id = v_orig_lot) INTO v_lot_exists;
          IF v_lot_exists THEN
            UPDATE public.inventory_lots
               SET cantidad_disponible = cantidad_disponible + v_item.cantidad
             WHERE id = v_orig_lot;
          ELSE
            INSERT INTO public.inventory_lots (
              product_id, cantidad_inicial, cantidad_disponible,
              costo_unitario, fecha_ingreso, user_id
            ) VALUES (
              v_item.product_id, v_item.cantidad, v_item.cantidad,
              COALESCE(v_item.costo_unitario, 0), CURRENT_DATE, v_user_id
            );
          END IF;
        END IF;
      END;
    END IF;
  END LOOP;

  -- Step 5: mark sale voided
  UPDATE public.sales
     SET estado = 'voided',
         void_reason = p_reason,
         void_journal_entry_id = v_new_entry_id
   WHERE id = p_sale_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
