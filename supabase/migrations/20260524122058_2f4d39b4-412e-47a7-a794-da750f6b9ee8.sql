
CREATE OR REPLACE FUNCTION public.get_accounts_with_entry_counts(
  _company_id uuid,
  _business_year_id uuid
)
RETURNS TABLE(account_code text, entry_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jei.account_code, COUNT(*)::bigint AS entry_count
  FROM public.journal_entry_items jei
  JOIN public.journal_entries je ON je.id = jei.journal_entry_id
  WHERE jei.company_id = _company_id
    AND je.business_year_id = _business_year_id
    AND je.status = 'posted'
    AND jei.account_code IS NOT NULL
    AND public.has_company_access(auth.uid(), _company_id)
  GROUP BY jei.account_code
  ORDER BY jei.account_code;
$$;

GRANT EXECUTE ON FUNCTION public.get_accounts_with_entry_counts(uuid, uuid) TO authenticated;
