REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.demo_environments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.qa_fixtures FROM authenticated;
GRANT SELECT ON public.demo_environments TO authenticated;
GRANT SELECT ON public.qa_fixtures TO authenticated;
GRANT ALL ON public.demo_environments TO service_role;
GRANT ALL ON public.qa_fixtures TO service_role;