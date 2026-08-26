UPDATE public.orders
SET gross_total_minor = total_minor,
    tax_total_minor = tax_minor,
    net_total_minor = total_minor - tax_minor
WHERE gross_total_minor = 0
  AND net_total_minor = 0
  AND tax_total_minor = 0
  AND total_minor <> 0
  AND tax_engine_version = 'none';