
-- Create warehouse_reservations table
CREATE TABLE public.warehouse_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  article_id UUID NOT NULL REFERENCES public.articles(id),
  article_code TEXT NOT NULL,
  article_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kom',
  quantity NUMERIC NOT NULL DEFAULT 0,
  reservation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  document_type TEXT NOT NULL, -- 'delivery_note', 'invoice', 'quote', 'other'
  document_id UUID,
  document_number TEXT NOT NULL,
  partner_id UUID REFERENCES public.partners(id),
  partner_code TEXT,
  partner_name TEXT,
  note TEXT,
  created_by UUID NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.warehouse_reservations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view reservations for their company"
  ON public.warehouse_reservations FOR SELECT
  USING (company_id IN (
    SELECT ura.company_id FROM public.user_role_assignments ura WHERE ura.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert reservations for their company"
  ON public.warehouse_reservations FOR INSERT
  WITH CHECK (company_id IN (
    SELECT ura.company_id FROM public.user_role_assignments ura WHERE ura.user_id = auth.uid()
  ));

CREATE POLICY "Users can update reservations for their company"
  ON public.warehouse_reservations FOR UPDATE
  USING (company_id IN (
    SELECT ura.company_id FROM public.user_role_assignments ura WHERE ura.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete reservations for their company"
  ON public.warehouse_reservations FOR DELETE
  USING (company_id IN (
    SELECT ura.company_id FROM public.user_role_assignments ura WHERE ura.user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX idx_warehouse_reservations_company ON public.warehouse_reservations(company_id);
CREATE INDEX idx_warehouse_reservations_warehouse ON public.warehouse_reservations(warehouse_id);
CREATE INDEX idx_warehouse_reservations_article ON public.warehouse_reservations(article_id);
CREATE INDEX idx_warehouse_reservations_date ON public.warehouse_reservations(reservation_date);
CREATE INDEX idx_warehouse_reservations_doc_type ON public.warehouse_reservations(document_type);

-- Updated_at trigger
CREATE TRIGGER update_warehouse_reservations_updated_at
  BEFORE UPDATE ON public.warehouse_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: Get stock with reservations for a warehouse
CREATE OR REPLACE FUNCTION public.get_warehouse_stock_with_reservations(
  p_company_id UUID,
  p_warehouse_id UUID,
  p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  article_id UUID,
  article_code TEXT,
  article_name TEXT,
  unit TEXT,
  balance_qty NUMERIC,
  balance_value NUMERIC,
  unit_price NUMERIC,
  reserved_delivery_notes NUMERIC,
  reserved_invoices NUMERIC,
  reserved_other NUMERIC,
  total_reserved NUMERIC,
  available_qty NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH stock AS (
    SELECT
      s.article_id,
      s.article_code,
      s.article_name,
      s.unit,
      s.balance_qty,
      s.balance_value
    FROM get_warehouse_stock(p_company_id, p_warehouse_id, NULL, p_date_to::TEXT) s
  ),
  reservations AS (
    SELECT
      r.article_id,
      COALESCE(SUM(CASE WHEN r.document_type = 'delivery_note' THEN r.quantity ELSE 0 END), 0) AS res_dn,
      COALESCE(SUM(CASE WHEN r.document_type = 'invoice' THEN r.quantity ELSE 0 END), 0) AS res_inv,
      COALESCE(SUM(CASE WHEN r.document_type NOT IN ('delivery_note', 'invoice') THEN r.quantity ELSE 0 END), 0) AS res_other,
      COALESCE(SUM(r.quantity), 0) AS res_total
    FROM warehouse_reservations r
    WHERE r.company_id = p_company_id
      AND r.warehouse_id = p_warehouse_id
      AND r.reservation_date <= p_date_to
    GROUP BY r.article_id
  )
  SELECT
    s.article_id,
    s.article_code,
    s.article_name,
    s.unit,
    s.balance_qty,
    s.balance_value,
    CASE WHEN s.balance_qty != 0 THEN s.balance_value / s.balance_qty ELSE 0 END AS unit_price,
    COALESCE(rv.res_dn, 0) AS reserved_delivery_notes,
    COALESCE(rv.res_inv, 0) AS reserved_invoices,
    COALESCE(rv.res_other, 0) AS reserved_other,
    COALESCE(rv.res_total, 0) AS total_reserved,
    s.balance_qty - COALESCE(rv.res_total, 0) AS available_qty
  FROM stock s
  LEFT JOIN reservations rv ON rv.article_id = s.article_id
  WHERE s.balance_qty != 0 OR COALESCE(rv.res_total, 0) != 0
  ORDER BY s.article_code;
END;
$$;
