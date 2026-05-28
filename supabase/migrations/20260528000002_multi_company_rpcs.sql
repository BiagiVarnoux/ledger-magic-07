-- ================================================================
-- Migration 2: Update RPCs for multi-company
-- File: 20260528000002_multi_company_rpcs.sql
-- Date: 2026-05-28
--
-- MUST run after 20260528000001_multi_company_schema.sql
--
-- Changes:
--   0.  Add company_id to invitation_codes
--   1.  next_journal_entry_id — new 3-arg company-aware overload
--         (old 2-arg version untouched for backward compat)
--   2.  assign_default_owner_role — stamps company_id in
--         user_roles INSERT; also inserts into company_members
--   3.  redeem_invitation_code — reads company_id from the code,
--         stamps user_roles and company_members
--   4.  create_sale — company_id in sales, journal_entries, and
--         every inventory_movements INSERT (Issue 1 fix: sales
--         INSERT column list is complete and explicit)
--   5.  void_sale — company_id throughout; FIFO restoration loops
--         ALL SALIDA movements per product (Issue 2 fix)
-- ================================================================


-- ================================================================
-- 0. Add company_id to invitation_codes
--    NOT NULL with DEFAULT so all existing rows are covered
--    automatically — no separate UPDATE needed.
-- ================================================================
ALTER TABLE public.invitation_codes
  ADD COLUMN IF NOT EXISTS company_id uuid
    NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.companies(id);


-- ================================================================
-- 1. next_journal_entry_id (3-arg company-aware overload)
--
-- Old 2-arg version (uuid, date) is left untouched — its grants
-- are preserved and existing callers continue to work unchanged.
--
-- New 3-arg version:
--   p_company_id IS NOT NULL → sequence counter is per-company
--   p_company_id IS NULL     → falls back to per-user (compat)
-- ================================================================
CREATE OR REPLACE FUNCTION public.next_journal_entry_id(
  p_user_id    uuid,
  p_date       date,
  p_company_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year    text;
  v_quarter int;
  v_qid     text;
  v_max     int := 0;
  v_seq     int;
BEGIN
  v_year    := to_char(p_date, 'YY');
  v_quarter := extract(quarter FROM p_date);
  v_qid     := 'Q' || v_quarter || '-' || v_year;

  IF p_company_id IS NOT NULL THEN
    SELECT COALESCE(MAX((substring(id FROM '^(\d{3})-')::int)), 0)
      INTO v_max
      FROM public.journal_entries
     WHERE company_id = p_company_id
       AND id LIKE '%-' || v_qid;
  ELSE
    SELECT COALESCE(MAX((substring(id FROM '^(\d{3})-')::int)), 0)
      INTO v_max
      FROM public.journal_entries
     WHERE user_id = p_user_id
       AND id LIKE '%-' || v_qid;
  END IF;

  v_seq := v_max + 1;
  RETURN lpad(v_seq::text, 3, '0') || '-' || v_qid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.next_journal_entry_id(uuid, date, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.next_journal_entry_id(uuid, date, uuid) TO authenticated;


-- ================================================================
-- 2. assign_default_owner_role
--
-- After migration 1, user_roles.company_id is NOT NULL.
-- Fix: add company_id to the user_roles INSERT, then also
-- register the user as a member of that company.
-- ================================================================
CREATE OR REPLACE FUNCTION public.assign_default_owner_role(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_company uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  INSERT INTO public.user_roles (user_id, role, company_id)
  VALUES (_user_id, 'owner'::app_role, v_default_company)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (v_default_company, _user_id, 'owner')
  ON CONFLICT (company_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ================================================================
-- 3. redeem_invitation_code
--
-- After migration 1, user_roles.company_id is NOT NULL.
-- Fix: read company_id from the invitation code row (falls back
-- to default company if the code pre-dates this migration), then
-- stamp both user_roles and company_members with it.
-- ================================================================
CREATE OR REPLACE FUNCTION public.redeem_invitation_code(_code text, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code_data  RECORD;
  _company_id uuid;
BEGIN
  SELECT * INTO _code_data
    FROM public.invitation_codes
   WHERE code       = _code
     AND used       = false
     AND expires_at > now()
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Código de invitación inválido o expirado'
    );
  END IF;

  _company_id := COALESCE(
    _code_data.company_id,
    '00000000-0000-0000-0000-000000000001'::uuid
  );

  UPDATE public.invitation_codes
     SET used    = true,
         used_by = _user_id
   WHERE id = _code_data.id;

  INSERT INTO public.shared_access (
    owner_id,
    viewer_id,
    can_view_accounts,
    can_view_journal,
    can_view_auxiliary,
    can_view_ledger,
    can_view_reports
  ) VALUES (
    _code_data.owner_id,
    _user_id,
    _code_data.can_view_accounts,
    _code_data.can_view_journal,
    _code_data.can_view_auxiliary,
    _code_data.can_view_ledger,
    _code_data.can_view_reports
  );

  -- Replace any existing role, then assign viewer with company_id
  DELETE FROM public.user_roles WHERE user_id = _user_id;

  INSERT INTO public.user_roles (user_id, role, company_id)
  VALUES (_user_id, 'viewer'::app_role, _company_id);

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (_company_id, _user_id, 'viewer')
  ON CONFLICT (company_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'permissions', jsonb_build_object(
      'can_view_accounts',  _code_data.can_view_accounts,
      'can_view_journal',   _code_data.can_view_journal,
      'can_view_auxiliary', _code_data.can_view_auxiliary,
      'can_view_ledger',    _code_data.can_view_ledger,
      'can_view_reports',   _code_data.can_view_reports
    )
  );
END;
$$;


-- ================================================================
-- 4. create_sale — full replacement, same jsonb signature
--
-- Issue 1 fix: INSERT INTO sales lists every column explicitly
--   one-per-line so column↔value alignment is unambiguous.
-- Added: v_company_id from payload stamped on sales,
--   journal_entries, and every inventory_movements INSERT.
-- Unchanged: journal_lines and sale_items have no company_id
--   column — they inherit it via their FK to the parent row.
-- ================================================================
CREATE OR REPLACE FUNCTION public.create_sale(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid    := auth.uid();
  v_company_id   uuid    := NULLIF(payload->>'company_id', '')::uuid;
  v_fecha        date    := (payload->>'fecha')::date;
  v_canal        text    := payload->>'canal';
  v_con_factura  boolean := COALESCE((payload->>'con_factura')::boolean, false);
  v_tipo_pago    text    := payload->>'tipo_pago';
  v_cliente      text    := payload->>'cliente_nombre';
  v_glosa        text    := payload->>'glosa';
  v_aux_entry_id uuid    := NULLIF(payload->>'aux_entry_id', '')::uuid;

  v_total_cobrado numeric(18,2) := (payload->>'total_cobrado')::numeric;
  v_total_iva     numeric(18,2) := COALESCE((payload->>'total_iva')::numeric, 0);
  v_total_it      numeric(18,2) := COALESCE((payload->>'total_it')::numeric, 0);
  v_precio_neto   numeric(18,2) := (payload->>'precio_neto_total')::numeric;

  v_payment_account text := payload->>'payment_account';
  v_revenue_account text := payload->>'revenue_account';
  v_cogs_account    text := payload->>'cogs_account';

  v_entry_id    text;
  v_numero      text;
  v_sale_id     uuid := gen_random_uuid();

  v_item        jsonb;
  v_product_id  uuid;
  v_metodo      text;
  v_cantidad    numeric(18,4);
  v_precio_u    numeric(18,4);
  v_subtotal    numeric(18,2);
  v_cuenta_inv  text;
  v_costo_u     numeric(18,6);
  v_costo_t     numeric(18,2);
  v_total_costo numeric(18,2) := 0;
  v_mov_id      uuid;

  v_stock       numeric;
  v_valor       numeric;
  v_lot         RECORD;
  v_remaining   numeric;
  v_take        numeric;

  v_inv_totals  jsonb := '{}'::jsonb;
  v_account_id  text;
  v_amount      numeric;
  v_iva         numeric;
  v_neto        numeric;
  v_it          numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF v_payment_account IS NULL OR v_revenue_account IS NULL OR v_cogs_account IS NULL THEN
    RAISE EXCEPTION 'Cuentas no resueltas';
  END IF;

  -- Step 1: generate IDs via the company-aware 3-arg overload
  v_entry_id := public.next_journal_entry_id(v_user_id, v_fecha, v_company_id);
  v_numero   := 'VTA-' || v_entry_id;

  -- Step 2: insert sale header
  -- Columns and values listed one-per-line for clarity (Issue 1 fix)
  INSERT INTO public.sales (
    id,
    user_id,
    company_id,
    numero,
    fecha,
    canal,
    con_factura,
    tipo_pago,
    cliente_nombre,
    aux_entry_id,
    glosa,
    total_cobrado,
    total_iva,
    total_it,
    precio_neto_total,
    estado
  ) VALUES (
    v_sale_id,
    v_user_id,
    v_company_id,
    v_numero,
    v_fecha,
    v_canal,
    v_con_factura,
    v_tipo_pago,
    v_cliente,
    v_aux_entry_id,
    v_glosa,
    v_total_cobrado,
    v_total_iva,
    v_total_it,
    v_precio_neto,
    'confirmed'
  );

  -- Step 3: per item — resolve cost + inventory movement + sale_item
  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_metodo     := v_item->>'metodo_valuacion';
    v_cantidad   := (v_item->>'cantidad')::numeric;
    v_precio_u   := (v_item->>'precio_unitario_neto')::numeric;
    v_subtotal   := round((v_cantidad * v_precio_u)::numeric, 2);
    v_cuenta_inv := v_item->>'cuenta_inventario_id';

    IF v_metodo = 'CPP' THEN
      SELECT
        COALESCE(SUM(CASE WHEN tipo = 'ENTRADA'      THEN  cantidad
                          WHEN tipo = 'SALIDA'       THEN -cantidad
                          ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo = 'ENTRADA'      THEN  costo_total
                          WHEN tipo = 'SALIDA'       THEN -costo_total
                          WHEN tipo = 'AJUSTE_COSTO' THEN  costo_total
                          ELSE 0 END), 0)
        INTO v_stock, v_valor
        FROM public.inventory_movements
       WHERE product_id = v_product_id AND user_id = v_user_id;

      IF v_stock < v_cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para producto % (disponible %, solicitado %)',
          (v_item->>'product_nombre'), v_stock, v_cantidad;
      END IF;

      v_costo_u := CASE WHEN v_stock > 0
                        THEN round((v_valor / v_stock)::numeric, 6)
                        ELSE 0 END;
      v_costo_t := round((v_costo_u * v_cantidad)::numeric, 2);

      v_mov_id := gen_random_uuid();
      INSERT INTO public.inventory_movements (
        id,
        product_id,
        tipo,
        cantidad,
        costo_unitario,
        costo_total,
        metodo_valuacion,
        referencia,
        journal_entry_id,
        fecha,
        user_id,
        company_id
      ) VALUES (
        v_mov_id,
        v_product_id,
        'SALIDA',
        v_cantidad,
        v_costo_u,
        v_costo_t,
        'CPP',
        COALESCE(v_glosa, v_numero),
        v_entry_id,
        v_fecha,
        v_user_id,
        v_company_id
      );

    ELSIF v_metodo = 'FIFO' THEN
      v_remaining := v_cantidad;
      v_costo_t   := 0;

      FOR v_lot IN
        SELECT id, cantidad_disponible, costo_unitario
          FROM public.inventory_lots
         WHERE product_id          = v_product_id
           AND user_id             = v_user_id
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
          id,
          product_id,
          inventory_lot_id,
          tipo,
          cantidad,
          costo_unitario,
          costo_total,
          metodo_valuacion,
          referencia,
          journal_entry_id,
          fecha,
          user_id,
          company_id
        ) VALUES (
          v_mov_id,
          v_product_id,
          v_lot.id,
          'SALIDA',
          v_take,
          v_lot.costo_unitario,
          round((v_take * v_lot.costo_unitario)::numeric, 2),
          'FIFO',
          COALESCE(v_glosa, v_numero),
          v_entry_id,
          v_fecha,
          v_user_id,
          v_company_id
        );

        v_costo_t   := v_costo_t + round((v_take * v_lot.costo_unitario)::numeric, 2);
        v_remaining := v_remaining - v_take;
      END LOOP;

      IF v_remaining > 0 THEN
        RAISE EXCEPTION 'Stock FIFO insuficiente para producto % (faltan %)',
          (v_item->>'product_nombre'), v_remaining;
      END IF;

      v_costo_u := CASE WHEN v_cantidad > 0
                        THEN round((v_costo_t / v_cantidad)::numeric, 6)
                        ELSE 0 END;
    ELSE
      RAISE EXCEPTION 'Método de valuación inválido: %', v_metodo;
    END IF;

    -- sale_items has no company_id column — inherits via sale_id FK
    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      product_nombre,
      product_codigo,
      cuenta_inventario_id,
      metodo_valuacion,
      cantidad,
      precio_unitario_neto,
      subtotal_neto,
      costo_unitario,
      costo_total,
      margen_bruto,
      inventory_movement_id
    ) VALUES (
      v_sale_id,
      v_product_id,
      v_item->>'product_nombre',
      v_item->>'product_codigo',
      v_cuenta_inv,
      v_metodo,
      v_cantidad,
      v_precio_u,
      v_subtotal,
      v_costo_u,
      v_costo_t,
      round((v_subtotal - v_costo_t)::numeric, 2),
      v_mov_id
    );

    v_total_costo := v_total_costo + v_costo_t;

    IF v_cuenta_inv IS NOT NULL AND v_cuenta_inv <> '' THEN
      v_inv_totals := jsonb_set(
        v_inv_totals,
        ARRAY[v_cuenta_inv],
        to_jsonb(round(
          (COALESCE((v_inv_totals ->> v_cuenta_inv)::numeric, 0) + v_costo_t)::numeric, 2
        ))
      );
    END IF;
  END LOOP;

  -- Step 4: journal entry with company_id
  -- journal_lines has no company_id — inherits via entry_id FK
  INSERT INTO public.journal_entries (id, user_id, company_id, date, memo)
  VALUES (v_entry_id, v_user_id, v_company_id, v_fecha, COALESCE(v_glosa, v_numero));

  -- Step 5: journal lines
  IF NOT v_con_factura THEN
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_entry_id, v_payment_account, v_total_cobrado, 0, v_numero);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_entry_id, v_revenue_account, 0, v_total_cobrado, v_numero);
  ELSE
    v_iva  := round((v_total_cobrado * 0.13)::numeric, 2);
    v_neto := round((v_total_cobrado - v_iva)::numeric, 2);
    v_it   := round((v_total_cobrado * 0.03)::numeric, 2);

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_entry_id, v_payment_account, v_total_cobrado, 0, v_numero);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_entry_id, 'P.3', 0, v_iva, 'IVA Débito Fiscal ' || v_numero);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_entry_id, v_revenue_account, 0, v_neto, v_numero);
  END IF;

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

  IF v_con_factura THEN
    v_it := round((v_total_cobrado * 0.03)::numeric, 2);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_entry_id, 'G.3', v_it, 0, 'IT ' || v_numero);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (v_entry_id, 'P.2', 0, v_it, 'IT por pagar ' || v_numero);
  END IF;

  -- Step 6: update sale totals
  UPDATE public.sales
     SET total_costo      = v_total_costo,
         journal_entry_id = v_entry_id
   WHERE id = v_sale_id;

  RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id, 'numero', v_numero);
END;
$$;


-- ================================================================
-- 5. void_sale — full replacement, same (uuid, text) signature
--
-- Issue 2 fix: FIFO lot restoration now loops over ALL SALIDA
--   movements for the original journal_entry + product, not just
--   the single movement referenced by inventory_movement_id.
--   Each loop iteration inserts its own reversal ENTRADA movement
--   and restores (or recreates) that specific lot.
--   v_fifo_mov RECORD added to DECLARE section.
-- Added: company_id on journal_entries INSERT, every
--   inventory_movements INSERT, and inventory_lots INSERT.
-- Unchanged: journal_lines — inherits company via entry_id FK.
-- ================================================================
CREATE OR REPLACE FUNCTION public.void_sale(p_sale_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_sale         RECORD;   -- includes company_id via SELECT *
  v_new_entry_id text;
  v_line         RECORD;
  v_item         RECORD;
  v_fifo_mov     RECORD;   -- each SALIDA movement per lot (Issue 2)
  v_lot_exists   boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_sale
    FROM public.sales
   WHERE id = p_sale_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;
  IF v_sale.estado = 'voided' THEN
    RAISE EXCEPTION 'La venta ya está anulada';
  END IF;
  IF v_sale.journal_entry_id IS NULL THEN
    RAISE EXCEPTION 'Venta sin asiento asociado';
  END IF;

  -- Step 1-2: new entry ID (company-aware) + reversal journal entry
  v_new_entry_id := public.next_journal_entry_id(
    v_user_id, CURRENT_DATE, v_sale.company_id
  );

  INSERT INTO public.journal_entries (
    id,
    user_id,
    company_id,
    date,
    memo,
    void_of
  ) VALUES (
    v_new_entry_id,
    v_user_id,
    v_sale.company_id,
    CURRENT_DATE,
    'Anulación ' || v_sale.numero || COALESCE(' — ' || p_reason, ''),
    v_sale.journal_entry_id
  );

  -- Step 3: copy lines with debit/credit swapped
  -- journal_lines has no company_id — inherits via entry_id FK
  FOR v_line IN
    SELECT account_id, debit, credit, line_memo
      FROM public.journal_lines
     WHERE entry_id = v_sale.journal_entry_id
  LOOP
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    VALUES (
      v_new_entry_id,
      v_line.account_id,
      v_line.credit,
      v_line.debit,
      'Anulación: ' || COALESCE(v_line.line_memo, '')
    );
  END LOOP;

  -- Step 4: restore inventory per sale_item
  FOR v_item IN
    SELECT * FROM public.sale_items WHERE sale_id = p_sale_id
  LOOP
    IF v_item.metodo_valuacion = 'CPP' THEN
      -- CPP: one reversal ENTRADA movement for the whole item
      INSERT INTO public.inventory_movements (
        product_id,
        inventory_lot_id,
        tipo,
        cantidad,
        costo_unitario,
        costo_total,
        metodo_valuacion,
        referencia,
        journal_entry_id,
        fecha,
        user_id,
        company_id
      ) VALUES (
        v_item.product_id,
        NULL,
        'ENTRADA',
        v_item.cantidad,
        COALESCE(v_item.costo_unitario, 0),
        COALESCE(v_item.costo_total, 0),
        'CPP',
        'Reversión ' || v_sale.numero,
        v_new_entry_id,
        CURRENT_DATE,
        v_user_id,
        v_sale.company_id
      );

    ELSIF v_item.metodo_valuacion = 'FIFO' THEN
      -- Issue 2 fix: loop over ALL SALIDA movements that the
      -- original sale created for this product. This correctly
      -- restores every lot consumed, not just the last one.
      FOR v_fifo_mov IN
        SELECT inventory_lot_id, cantidad, costo_unitario
          FROM public.inventory_movements
         WHERE journal_entry_id = v_sale.journal_entry_id
           AND product_id       = v_item.product_id
           AND tipo             = 'SALIDA'
           AND user_id          = v_user_id
      LOOP
        -- Reversal ENTRADA movement for this lot slice
        INSERT INTO public.inventory_movements (
          product_id,
          inventory_lot_id,
          tipo,
          cantidad,
          costo_unitario,
          costo_total,
          metodo_valuacion,
          referencia,
          journal_entry_id,
          fecha,
          user_id,
          company_id
        ) VALUES (
          v_item.product_id,
          v_fifo_mov.inventory_lot_id,
          'ENTRADA',
          v_fifo_mov.cantidad,
          v_fifo_mov.costo_unitario,
          round((v_fifo_mov.cantidad * v_fifo_mov.costo_unitario)::numeric, 2),
          'FIFO',
          'Reversión ' || v_sale.numero,
          v_new_entry_id,
          CURRENT_DATE,
          v_user_id,
          v_sale.company_id
        );

        -- Restore the lot's available quantity
        IF v_fifo_mov.inventory_lot_id IS NOT NULL THEN
          SELECT EXISTS(
            SELECT 1 FROM public.inventory_lots
             WHERE id = v_fifo_mov.inventory_lot_id
          ) INTO v_lot_exists;

          IF v_lot_exists THEN
            UPDATE public.inventory_lots
               SET cantidad_disponible = cantidad_disponible + v_fifo_mov.cantidad
             WHERE id = v_fifo_mov.inventory_lot_id;
          ELSE
            -- Lot was deleted since the original sale — recreate it
            INSERT INTO public.inventory_lots (
              product_id,
              cantidad_inicial,
              cantidad_disponible,
              costo_unitario,
              fecha_ingreso,
              user_id,
              company_id
            ) VALUES (
              v_item.product_id,
              v_fifo_mov.cantidad,
              v_fifo_mov.cantidad,
              v_fifo_mov.costo_unitario,
              CURRENT_DATE,
              v_user_id,
              v_sale.company_id
            );
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- Step 5: mark sale voided
  UPDATE public.sales
     SET estado                = 'voided',
         void_reason           = p_reason,
         void_journal_entry_id = v_new_entry_id
   WHERE id = p_sale_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
