-- Función para obtener el balance de comprobación para un periodo (yyyy-mm)
CREATE OR REPLACE FUNCTION public.get_trial_balance(period text)
RETURNS TABLE (
  id text,
  name text,
  debit numeric,
  credit numeric,
  balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH period_entries AS (
    SELECT
      jl.account_id,
      SUM(jl.debit) as debit,
      SUM(jl.credit) as credit
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.entry_id
    WHERE
      TO_CHAR(je.date, 'YYYY-MM') = period
      AND je.user_id = auth.uid()
    GROUP BY
      jl.account_id
  )
  SELECT
    a.id,
    a.name,
    COALESCE(pe.debit, 0) as debit,
    COALESCE(pe.credit, 0) as credit,
    CASE a.normal_side
      WHEN 'DEBE' THEN (COALESCE(pe.debit, 0) - COALESCE(pe.credit, 0))
      WHEN 'HABER' THEN (COALESCE(pe.credit, 0) - COALESCE(pe.debit, 0))
      ELSE 0
    END as balance
  FROM public.accounts a
  LEFT JOIN period_entries pe ON a.id = pe.account_id
  WHERE a.user_id = auth.uid()
  ORDER BY a.id;
END;
$$;

-- Función para obtener el estado de resultados para un rango de fechas
CREATE OR REPLACE FUNCTION public.get_income_statement(from_date date, to_date date)
RETURNS TABLE (
  ingresos numeric,
  gastos numeric,
  utilidad numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH report_totals AS (
    SELECT
      a.type,
      SUM(
        CASE a.type
          WHEN 'INGRESO' THEN (jl.credit - jl.debit)
          WHEN 'GASTO' THEN (jl.debit - jl.credit)
          ELSE 0
        END
      ) as total
    FROM public.accounts a
    JOIN public.journal_lines jl ON jl.account_id = a.id
    JOIN public.journal_entries je ON je.id = jl.entry_id
    WHERE
      je.date >= from_date
      AND je.date <= to_date
      AND a.user_id = auth.uid()
      AND a.type IN ('INGRESO', 'GASTO')
    GROUP BY
      a.type
  )
  SELECT
    COALESCE(SUM(CASE WHEN type = 'INGRESO' THEN total ELSE 0 END), 0) as ingresos,
    COALESCE(SUM(CASE WHEN type = 'GASTO' THEN total ELSE 0 END), 0) as gastos,
    COALESCE(SUM(CASE WHEN type = 'INGRESO' THEN total ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN type = 'GASTO' THEN total ELSE 0 END), 0) as utilidad
  FROM report_totals;
END;
$$;

-- Función para obtener el balance general a una fecha específica
CREATE OR REPLACE FUNCTION public.get_balance_sheet(as_of_date date)
RETURNS TABLE (
  tipo text,
  saldo numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH account_balances AS (
    SELECT
      a.type as tipo,
      SUM(
        CASE a.normal_side
          WHEN 'DEBE' THEN (jl.debit - jl.credit)
          WHEN 'HABER' THEN (jl.credit - jl.debit)
          ELSE 0
        END
      ) as saldo
    FROM public.accounts a
    LEFT JOIN public.journal_lines jl ON jl.account_id = a.id
    LEFT JOIN public.journal_entries je ON je.id = jl.entry_id
    WHERE
      (je.date IS NULL OR je.date <= as_of_date)
      AND a.user_id = auth.uid()
      AND a.type IN ('ACTIVO', 'PASIVO', 'PATRIMONIO')
    GROUP BY
      a.type
  ),
  profit_loss AS (
    SELECT
      'PATRIMONIO' as tipo,
      SUM(
        CASE a.type
          WHEN 'INGRESO' THEN (jl.credit - jl.debit)
          WHEN 'GASTO' THEN (jl.debit - jl.credit)
          ELSE 0
        END
      ) as saldo
    FROM public.accounts a
    LEFT JOIN public.journal_lines jl ON jl.account_id = a.id
    LEFT JOIN public.journal_entries je ON je.id = jl.entry_id
    WHERE
      (je.date IS NULL OR je.date <= as_of_date)
      AND a.user_id = auth.uid()
      AND a.type IN ('INGRESO', 'GASTO')
  )
  SELECT tipo, SUM(saldo) as saldo
  FROM (
    SELECT tipo, saldo FROM account_balances
    UNION ALL
    SELECT tipo, saldo FROM profit_loss
  ) combined
  GROUP BY tipo
  ORDER BY tipo;
END;
$$;

-- Conceder permisos de ejecución
GRANT EXECUTE ON FUNCTION public.get_trial_balance(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_income_statement(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_balance_sheet(date) TO authenticated;