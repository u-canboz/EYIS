-- EYIS System Seed — 005_tax_system: System-Steuerklassen und DE-Preset
--
-- ERZEUGT von scripts/installer/generate-system-seeds.ts. Nicht von Hand ändern.
-- Quelle: 20260825143734, 20260825143734
-- Idempotent: mehrfaches Ausführen verändert nichts.

DO $eyis_seed$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tax_classes WHERE is_system AND organization_id IS NULL) THEN
  INSERT INTO public.tax_classes (organization_id, name, code, description, is_system) VALUES
    (NULL,'Standard','standard','Regelsteuersatz',true),
    (NULL,'Ermäßigt','reduced','Ermäßigter Steuersatz',true),
    (NULL,'Steuerfrei','zero','Steuerfrei / 0 %',true),
    (NULL,'Digitale Leistung','digital','Digitale Dienstleistungen',true),
    (NULL,'Lebensmittel','food','Lebensmittel — steuerliche Einordnung bitte prüfen',true),
    (NULL,'Bücher','books','Bücher und Presseerzeugnisse',true),
    (NULL,'Versand','shipping','Versandkosten',true);

  INSERT INTO public.tax_rates (organization_id, tax_class_id, country_code, rate_basis_points, customer_type, source, metadata)
  SELECT NULL, tc.id, 'DE',
    CASE tc.code WHEN 'standard' THEN 1900 WHEN 'reduced' THEN 700 WHEN 'zero' THEN 0
      WHEN 'digital' THEN 1900 WHEN 'food' THEN 700 WHEN 'books' THEN 700 WHEN 'shipping' THEN 1900 END,
    'any', 'system', jsonb_build_object('label','Deutschland')
  FROM public.tax_classes tc WHERE tc.organization_id IS NULL AND tc.is_system;
  END IF;
END
$eyis_seed$;
