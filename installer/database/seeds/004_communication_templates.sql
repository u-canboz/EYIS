-- EYIS System Seed — 004_communication_templates: System-E-Mail-Vorlagen
--
-- ERZEUGT von scripts/installer/generate-system-seeds.ts. Nicht von Hand ändern.
-- Quelle: 20260825182452
-- Idempotent: mehrfaches Ausführen verändert nichts.

DO $eyis_seed$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.communication_templates WHERE is_system AND organization_id IS NULL) THEN
  WITH seed(key, category, name, description, subject, heading, intro, block, cta, cta_url, active) AS (VALUES
    ('order.confirmed','orders','Bestellbestätigung','Wird nach Eingang einer Bestellung versendet.','Ihre Bestellung {{order.number}}','Danke für Ihre Bestellung','Hallo {{customer.first_name}}, wir haben Ihre Bestellung erhalten und bereiten sie vor.','order_summary','Bestellung ansehen','{{links.order}}',true),
    ('payment.confirmed','payments','Zahlungsbestätigung','Bestätigt den Zahlungseingang.','Zahlung zu {{order.number}} erhalten','Zahlung erhalten','Hallo {{customer.first_name}}, wir haben Ihre Zahlung zur Bestellung {{order.number}} erhalten.','payment_summary','Bestellung ansehen','{{links.order}}',true),
    ('payment.failed','payments','Zahlung fehlgeschlagen','Information über eine fehlgeschlagene Zahlung.','Zahlung zu {{order.number}} fehlgeschlagen','Zahlung fehlgeschlagen','Hallo {{customer.first_name}}, die Zahlung zu Ihrer Bestellung {{order.number}} konnte nicht abgeschlossen werden.','payment_summary','Bestellung ansehen','{{links.order}}',true),
    ('refund.completed','payments','Erstattung abgeschlossen','Information über eine abgeschlossene Erstattung.','Erstattung zu {{order.number}}','Wir haben Ihnen {{refund.amount}} erstattet','Hallo {{customer.first_name}}, die Erstattung zu Ihrer Bestellung {{order.number}} ist veranlasst.','refund_summary','Bestellung ansehen','{{links.order}}',true),
    ('shipment.created','shipping','Sendung vorbereitet','Sendung wurde angelegt.','Ihre Bestellung {{order.number}} wird vorbereitet','Ihre Sendung wird vorbereitet','Hallo {{customer.first_name}}, wir stellen Ihre Bestellung gerade zusammen.','shipment_summary','Bestellung ansehen','{{links.order}}',true),
    ('shipment.shipped','shipping','Versandbestätigung','Sendung ist unterwegs.','Ihre Bestellung {{order.number}} ist unterwegs','Ihre Sendung ist unterwegs','Hallo {{customer.first_name}}, Ihre Sendung wurde an {{shipment.carrier}} übergeben.','tracking','Sendung verfolgen','{{links.tracking}}',true),
    ('shipment.out_for_delivery','shipping','In Zustellung','Sendung ist in Zustellung.','Ihre Sendung ist in Zustellung','Ihre Sendung ist heute unterwegs zu Ihnen','Hallo {{customer.first_name}}, Ihre Sendung befindet sich in Zustellung.','tracking','Sendung verfolgen','{{links.tracking}}',true),
    ('shipment.delivered','shipping','Zustellbestätigung','Sendung wurde zugestellt.','Ihre Bestellung {{order.number}} wurde zugestellt','Ihre Bestellung wurde zugestellt','Hallo {{customer.first_name}}, Ihre Sendung wurde zugestellt.','shipment_summary','Bestellung ansehen','{{links.order}}',true),
    ('shipment.exception','shipping','Versandproblem','Es gibt ein Problem mit der Sendung.','Problem bei Ihrer Sendung zu {{order.number}}','Es gibt ein Problem mit Ihrer Sendung','Hallo {{customer.first_name}}, bei der Zustellung ist ein Problem aufgetreten. Wir kümmern uns darum.','tracking','Sendung verfolgen','{{links.tracking}}',true),
    ('invoice.issued','documents','Rechnung','Rechnung wurde ausgestellt.','Ihre Rechnung {{invoice.number}}','Ihre Rechnung liegt bereit','Hallo {{customer.first_name}}, anbei erhalten Sie Ihre Rechnung {{invoice.number}} zur Bestellung {{order.number}}.','document','Rechnung herunterladen','{{links.document}}',true),
    ('credit_note.issued','documents','Gutschrift','Gutschrift wurde ausgestellt.','Ihre Gutschrift {{credit_note.number}}','Ihre Gutschrift liegt bereit','Hallo {{customer.first_name}}, wir haben eine Gutschrift zu Ihrer Bestellung {{order.number}} erstellt.','document','Gutschrift herunterladen','{{links.document}}',true),
    ('return.requested','returns','Retoure eingegangen','Retourenantrag wurde erfasst.','Ihre Retoure {{return.number}}','Wir haben Ihren Retourenantrag erhalten','Hallo {{customer.first_name}}, wir prüfen Ihren Antrag und melden uns kurzfristig.','return_summary','Retoure ansehen','{{links.return}}',true),
    ('return.authorized','returns','Retoure genehmigt','Retoure wurde genehmigt.','Ihre Retoure {{return.number}} wurde genehmigt','Ihre Retoure wurde genehmigt','Hallo {{customer.first_name}}, bitte senden Sie die Artikel gemäß den Rücksendehinweisen zurück.','return_summary','Retoure ansehen','{{links.return}}',true),
    ('return.rejected','returns','Retoure abgelehnt','Retoure wurde abgelehnt.','Ihre Retoure {{return.number}}','Ihre Retoure wurde abgelehnt','Hallo {{customer.first_name}}, leider können wir Ihre Retoure nicht annehmen.','return_summary','Retoure ansehen','{{links.return}}',true),
    ('return.received','returns','Retoure eingetroffen','Rücksendung ist eingetroffen.','Ihre Rücksendung {{return.number}} ist da','Ihre Rücksendung ist eingetroffen','Hallo {{customer.first_name}}, wir haben Ihre Rücksendung erhalten und prüfen sie.','return_summary','Retoure ansehen','{{links.return}}',true),
    ('return.approved','returns','Retoure freigegeben','Prüfung abgeschlossen.','Ihre Retoure {{return.number}} ist freigegeben','Prüfung abgeschlossen','Hallo {{customer.first_name}}, die Prüfung Ihrer Rücksendung ist abgeschlossen.','return_summary','Retoure ansehen','{{links.return}}',true),
    ('return.partially_approved','returns','Retoure teilweise freigegeben','Prüfung teilweise abgeschlossen.','Ihre Retoure {{return.number}} wurde teilweise freigegeben','Ein Teil Ihrer Rücksendung wurde freigegeben','Hallo {{customer.first_name}}, ein Teil der zurückgesendeten Artikel wurde freigegeben.','return_summary','Retoure ansehen','{{links.return}}',true),
    ('return.refunded','returns','Retoure erstattet','Erstattung zur Retoure.','Erstattung zu Ihrer Retoure {{return.number}}','Wir haben Ihnen {{refund.amount}} erstattet','Hallo {{customer.first_name}}, die Erstattung zu Ihrer Retoure ist veranlasst.','refund_summary','Retoure ansehen','{{links.return}}',true),
    ('return.completed','returns','Retoure abgeschlossen','Retoure abgeschlossen.','Ihre Retoure {{return.number}} ist abgeschlossen','Ihre Retoure ist abgeschlossen','Hallo {{customer.first_name}}, Ihre Retoure ist abgeschlossen. Danke für Ihre Geduld.','return_summary','Retoure ansehen','{{links.return}}',true),
    ('customer.welcome','customer','Willkommen','Begrüßung nach der Registrierung.','Willkommen bei {{shop.name}}','Willkommen bei {{shop.name}}','Hallo {{customer.first_name}}, Ihr Kundenkonto ist eingerichtet. Dort finden Sie Bestellungen, Belege und Retouren.','divider','Zum Kundenkonto','{{links.portal}}',true),
    ('guest_order_access','customer','Gastzugang zur Bestellung','Kurzlebiger Zugangslink für Gäste.','Ihr Zugang zur Bestellung {{order.number}}','Ihr Zugangslink','Hallo, über den folgenden Link erreichen Sie Ihre Bestellung {{order.number}}. Der Link ist zeitlich begrenzt gültig.','divider','Bestellung öffnen','{{links.guest_access}}',true),
    ('customer.email_verification','customer','E-Mail-Bestätigung','Vorbereitet. Der Versand läuft weiterhin über die Anmeldeinfrastruktur.','Bitte bestätigen Sie Ihre E-Mail-Adresse','E-Mail bestätigen','Hallo, bitte bestätigen Sie Ihre E-Mail-Adresse.','divider','E-Mail bestätigen','{{links.portal}}',false),
    ('customer.password_reset','customer','Passwort zurücksetzen','Vorbereitet. Der Versand läuft weiterhin über die Anmeldeinfrastruktur.','Passwort zurücksetzen','Passwort zurücksetzen','Hallo, Sie können Ihr Passwort über den folgenden Link neu vergeben.','divider','Passwort neu vergeben','{{links.portal}}',false)
  ), inserted AS (
    INSERT INTO public.communication_templates
      (organization_id, shop_id, key, channel, name, description, category, status, is_system, version, default_locale, subject_template, content_schema)
    SELECT NULL, NULL, key, 'email', name, description, category,
           CASE WHEN active THEN 'active' ELSE 'disabled' END::public.communication_template_status,
           true, 1, 'de-DE', subject,
           jsonb_build_object('required_blocks', CASE WHEN block IN ('divider') THEN '[]'::jsonb ELSE jsonb_build_array(block) END)
    FROM seed
    RETURNING id, key
  )
  INSERT INTO public.communication_template_versions
    (template_id, version, locale, subject, preheader, body_schema, text_body_template, published_at)
  SELECT i.id, 1, 'de-DE', s.subject, s.heading,
    jsonb_build_array(
      jsonb_build_object('type','logo'),
      jsonb_build_object('type','heading','text', s.heading),
      jsonb_build_object('type','text','text', s.intro),
      jsonb_build_object('type', s.block),
      jsonb_build_object('type','button','label', s.cta, 'url', s.cta_url),
      jsonb_build_object('type','footer')
    ),
    '', now()
  FROM inserted i JOIN seed s ON s.key = i.key;
  END IF;
END
$eyis_seed$;
