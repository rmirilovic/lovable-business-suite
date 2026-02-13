
-- Add is_procurement_cost to input_costs table
ALTER TABLE public.input_costs ADD COLUMN is_procurement_cost boolean NOT NULL DEFAULT false;

-- Migrate existing data: set is_procurement_cost on input_costs where their account_code matches a procurement cost account
UPDATE public.input_costs ic
SET is_procurement_cost = true
FROM public.chart_of_accounts coa
WHERE ic.account_code = coa.code
  AND ic.company_id = coa.company_id
  AND coa.is_procurement_cost = true;

-- Remove is_procurement_cost from chart_of_accounts
ALTER TABLE public.chart_of_accounts DROP COLUMN is_procurement_cost;
