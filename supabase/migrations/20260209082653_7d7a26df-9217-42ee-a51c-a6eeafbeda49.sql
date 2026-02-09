
-- =====================================================
-- Kalkulacija nabavne cene (Purchase Price Calculation)
-- =====================================================

-- Glavni dokument kalkulacije
CREATE TABLE public.purchase_price_calculations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_year_id UUID NOT NULL REFERENCES public.business_years(id),
  goods_receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id),
  calculation_number TEXT NOT NULL,
  calculation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  total_purchase_value NUMERIC NOT NULL DEFAULT 0,
  total_additional_costs NUMERIC NOT NULL DEFAULT 0,
  total_cost_value NUMERIC NOT NULL DEFAULT 0,
  total_markup_value NUMERIC NOT NULL DEFAULT 0,
  total_selling_value NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID NOT NULL,
  posted_by UUID,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Jedan obracun po prijemnici
CREATE UNIQUE INDEX idx_unique_calc_per_receipt 
  ON public.purchase_price_calculations(goods_receipt_id) 
  WHERE status != 'cancelled';

ALTER TABLE public.purchase_price_calculations ENABLE ROW LEVEL SECURITY;

-- Zavisni troskovi (transport, utovar, osiguranje itd.)
CREATE TABLE public.calculation_additional_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_id UUID NOT NULL REFERENCES public.purchase_price_calculations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  distribution_method TEXT NOT NULL DEFAULT 'by_value',
  item_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calculation_additional_costs ENABLE ROW LEVEL SECURITY;

-- Stavke kalkulacije sa obracunom cena
CREATE TABLE public.calculation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_id UUID NOT NULL REFERENCES public.purchase_price_calculations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  goods_receipt_item_id UUID REFERENCES public.goods_receipt_items(id),
  article_id UUID REFERENCES public.articles(id),
  item_code TEXT,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kom',
  svk TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  purchase_value NUMERIC NOT NULL DEFAULT 0,
  allocated_costs NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  cost_value NUMERIC NOT NULL DEFAULT 0,
  markup_percent NUMERIC NOT NULL DEFAULT 0,
  markup_amount NUMERIC NOT NULL DEFAULT 0,
  selling_price NUMERIC NOT NULL DEFAULT 0,
  selling_value NUMERIC NOT NULL DEFAULT 0,
  item_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calculation_items ENABLE ROW LEVEL SECURITY;

-- RLS polise - purchase_price_calculations
CREATE POLICY "Users can view calculations for their companies"
  ON public.purchase_price_calculations FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert calculations for their companies"
  ON public.purchase_price_calculations FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update calculations for their companies"
  ON public.purchase_price_calculations FOR UPDATE
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete draft calculations for their companies"
  ON public.purchase_price_calculations FOR DELETE
  USING (has_company_access(auth.uid(), company_id) AND status = 'draft');

-- RLS polise - calculation_additional_costs
CREATE POLICY "Users can view calculation costs for their companies"
  ON public.calculation_additional_costs FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert calculation costs for their companies"
  ON public.calculation_additional_costs FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update calculation costs for their companies"
  ON public.calculation_additional_costs FOR UPDATE
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete calculation costs for their companies"
  ON public.calculation_additional_costs FOR DELETE
  USING (has_company_access(auth.uid(), company_id));

-- RLS polise - calculation_items
CREATE POLICY "Users can view calculation items for their companies"
  ON public.calculation_items FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert calculation items for their companies"
  ON public.calculation_items FOR INSERT
  WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update calculation items for their companies"
  ON public.calculation_items FOR UPDATE
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete calculation items for their companies"
  ON public.calculation_items FOR DELETE
  USING (has_company_access(auth.uid(), company_id));

-- Funkcija za generisanje broja kalkulacije (KAL-YY-NNNN)
CREATE OR REPLACE FUNCTION public.get_next_calculation_number(_company_id UUID, _year_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year INT;
  _next_num INT;
  _result TEXT;
BEGIN
  SELECT year INTO _year FROM business_years WHERE id = _year_id;
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(calculation_number FROM 'KAL-\d{2}-(\d+)') AS INT)
  ), 0) + 1
  INTO _next_num
  FROM purchase_price_calculations
  WHERE company_id = _company_id AND business_year_id = _year_id;
  
  _result := 'KAL-' || RIGHT(_year::TEXT, 2) || '-' || LPAD(_next_num::TEXT, 4, '0');
  RETURN _result;
END;
$$;

-- Trigger za updated_at
CREATE TRIGGER update_purchase_price_calculations_updated_at
  BEFORE UPDATE ON public.purchase_price_calculations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
