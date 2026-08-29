-- EYIS Database Install Pack — Funktionen: automation (automation-functions-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.automation_check_limits(_rule_id uuid, _entity_key text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  hour_start timestamptz := date_trunc('hour', now());
  c integer;
BEGIN
  SELECT auto_paused_at, status, max_per_hour, max_per_entity
    INTO r FROM public.automation_rules WHERE id = _rule_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF r.auto_paused_at IS NOT NULL THEN RETURN 'circuit_open'; END IF;
  IF r.status <> 'active' THEN RETURN 'inactive'; END IF;

  IF r.max_per_hour IS NOT NULL THEN
    INSERT INTO public.automation_rule_counters (rule_id, bucket_kind, bucket_key, window_start, count)
    VALUES (_rule_id, 'hour', 'all', hour_start, 1)
    ON CONFLICT (rule_id, bucket_kind, bucket_key, window_start)
      DO UPDATE SET count = public.automation_rule_counters.count + 1, updated_at = now()
    RETURNING count INTO c;
    IF c > r.max_per_hour THEN RETURN 'rate_limited'; END IF;
  END IF;

  IF r.max_per_entity IS NOT NULL AND _entity_key IS NOT NULL THEN
    INSERT INTO public.automation_rule_counters (rule_id, bucket_kind, bucket_key, window_start, count)
    VALUES (_rule_id, 'entity', _entity_key, 'epoch'::timestamptz, 1)
    ON CONFLICT (rule_id, bucket_kind, bucket_key, window_start)
      DO UPDATE SET count = public.automation_rule_counters.count + 1, updated_at = now()
    RETURNING count INTO c;
    IF c > r.max_per_entity THEN RETURN 'rate_limited'; END IF;
  END IF;

  RETURN 'allow';
END;
$function$;

CREATE OR REPLACE FUNCTION public.automation_claim_jobs(_limit integer, _worker text)
 RETURNS SETOF automation_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.automation_jobs j
     SET status = 'running', locked_at = now(), locked_by = _worker,
         attempts = j.attempts + 1, updated_at = now()
   WHERE j.id IN (
     SELECT id FROM public.automation_jobs
      WHERE status = 'pending' AND available_at <= now()
      ORDER BY available_at
      LIMIT _limit
      FOR UPDATE SKIP LOCKED
   )
  RETURNING j.*;
END;
$function$;

CREATE OR REPLACE FUNCTION public.automation_record_error(_rule_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  win timestamptz;
  c integer;
BEGIN
  SELECT error_threshold, error_window_minutes, auto_paused_at
    INTO r FROM public.automation_rules WHERE id = _rule_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF r.auto_paused_at IS NOT NULL THEN RETURN 'circuit_open'; END IF;

  win := to_timestamp(floor(extract(epoch FROM now()) / (r.error_window_minutes * 60)) * (r.error_window_minutes * 60));
  INSERT INTO public.automation_rule_counters (rule_id, bucket_kind, bucket_key, window_start, count)
  VALUES (_rule_id, 'error', 'all', win, 1)
  ON CONFLICT (rule_id, bucket_kind, bucket_key, window_start)
    DO UPDATE SET count = public.automation_rule_counters.count + 1, updated_at = now()
  RETURNING count INTO c;

  IF c >= r.error_threshold THEN
    UPDATE public.automation_rules
      SET auto_paused_at = now(),
          auto_pause_reason = format('Automatisch pausiert: %s Fehler in %s Minuten.', c, r.error_window_minutes),
          status = 'paused'
      WHERE id = _rule_id;
    RETURN 'circuit_open';
  END IF;
  RETURN 'recorded';
END;
$function$;

CREATE OR REPLACE FUNCTION public.automation_version_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN IF TG_OP = 'DELETE' AND public.purge_mode() THEN RETURN OLD; END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'Veröffentlichte Automationsversionen können nicht gelöscht werden.';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'Veröffentlichte Automationsversionen sind unveränderbar.';
  END IF;
  RETURN NEW;
END;
$function$;
