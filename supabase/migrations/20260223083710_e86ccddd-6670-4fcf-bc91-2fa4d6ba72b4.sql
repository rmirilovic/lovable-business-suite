
DROP FUNCTION IF EXISTS public.get_warehouse_stock_with_reservations(uuid, uuid, date);

CREATE OR REPLACE FUNCTION public.get_warehouse_stock_with_reservations(
  p_company_id uuid,
  p_warehouse_id uuid,
  p_date_to date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  article_id uuid,
  article_code text,
  article_name text,
  unit text,
  balance_qty numeric,
  balance_value numeric,
  unit_price numeric,
  reserved_delivery_notes numeric,
  reserved_delivery_orders numeric,
  reserved_other numeric,
  total_reserved numeric,
  available_qty numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH stock AS (
    SELECT s.article_id, s.article_code, s.article_name, s.unit, s.balance_qty, s.balance_value
    FROM get_warehouse_stock(p_company_id, p_warehouse_id, NULL::date, p_date_to) s
  ),
  reservations AS (
    SELECT
      r.article_id,
      COALESCE(SUM(CASE WHEN r.document_type IN ('delivery_note', 'Otpremnica') THEN r.quantity ELSE 0 END), 0) AS res_dn,
      COALESCE(SUM(CASE WHEN r.document_type IN ('delivery_order', 'Nalog za isporuku') THEN r.quantity ELSE 0 END), 0) AS res_do,
      COALESCE(SUM(CASE WHEN r.document_type NOT IN ('delivery_note', 'Otpremnica', 'delivery_order', 'Nalog za isporuku') THEN r.quantity ELSE 0 END), 0) AS res_other,
      COALESCE(SUM(r.quantity), 0) AS res_total
    FROM warehouse_reservations r
    WHERE r.company_id = p_company_id AND r.warehouse_id = p_warehouse_id
    GROUP BY r.article_id
  )
  SELECT
    s.article_id, s.article_code, s.article_name, s.unit, s.balance_qty, s.balance_value,
    CASE WHEN s.balance_qty != 0 THEN s.balance_value / s.balance_qty ELSE 0 END AS unit_price,
    COALESCE(rv.res_dn, 0) AS reserved_delivery_notes,
    COALESCE(rv.res_do, 0) AS reserved_delivery_orders,
    COALESCE(rv.res_other, 0) AS reserved_other,
    COALESCE(rv.res_total, 0) AS total_reserved,
    s.balance_qty - COALESCE(rv.res_total, 0) AS available_qty
  FROM stock s
  LEFT JOIN reservations rv ON rv.article_id = s.article_id
  ORDER BY s.article_code;
END;
$function$;
