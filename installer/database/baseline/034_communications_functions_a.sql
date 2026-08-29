-- EYIS Database Install Pack — Funktionen: communications (communications-functions-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE OR REPLACE FUNCTION public.communication_provider_event_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN IF TG_OP = 'DELETE' AND public.purge_mode() THEN RETURN OLD; END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Provider-Events sind unveränderbar und werden nicht gelöscht.';
  END IF;
  IF NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.provider IS DISTINCT FROM OLD.provider
     OR NEW.provider_event_id IS DISTINCT FROM OLD.provider_event_id
     OR NEW.provider_message_id IS DISTINCT FROM OLD.provider_message_id
     OR NEW.event_type IS DISTINCT FROM OLD.event_type
     OR NEW.signature_verified IS DISTINCT FROM OLD.signature_verified
     OR NEW.received_at IS DISTINCT FROM OLD.received_at
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.shop_id IS DISTINCT FROM OLD.shop_id THEN
    RAISE EXCEPTION 'Nur der Verarbeitungsstatus eines Provider-Events darf geändert werden.';
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.communication_snapshot_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN IF TG_OP = 'DELETE' AND public.purge_mode() THEN RETURN OLD; END IF;
  IF NEW.subject_snapshot IS DISTINCT FROM OLD.subject_snapshot
     OR NEW.html_snapshot IS DISTINCT FROM OLD.html_snapshot
     OR NEW.text_snapshot IS DISTINCT FROM OLD.text_snapshot
     OR NEW.recipient_address IS DISTINCT FROM OLD.recipient_address
     OR NEW.template_version_id IS DISTINCT FROM OLD.template_version_id
     OR NEW.source_event_id IS DISTINCT FROM OLD.source_event_id THEN
    RAISE EXCEPTION 'Der Kommunikations-Snapshot ist unveränderbar.';
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.sender_domain_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'verified' AND (OLD.status IS DISTINCT FROM 'verified')
     AND current_setting('request.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Domain-Verifizierung nur über serverseitige Prüfung möglich';
  END IF;
  RETURN NEW;
END
$function$;
