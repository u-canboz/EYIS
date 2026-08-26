CREATE TABLE public.demo_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  seed_version text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','reset_pending')),
  seeded_at timestamptz NOT NULL DEFAULT now(),
  last_reset_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.demo_environments TO authenticated;
GRANT ALL ON public.demo_environments TO service_role;
ALTER TABLE public.demo_environments ENABLE ROW LEVEL SECURITY;
CREATE POLICY demo_environments_read ON public.demo_environments FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE TRIGGER set_demo_environments_updated_at BEFORE UPDATE ON public.demo_environments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.qa_fixtures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  scenario text NOT NULL,
  run_ref text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','destroyed','failed')),
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  residual_notes text,
  destroyed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.qa_fixtures TO authenticated;
GRANT ALL ON public.qa_fixtures TO service_role;
ALTER TABLE public.qa_fixtures ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_fixtures_read ON public.qa_fixtures FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE TRIGGER set_qa_fixtures_updated_at BEFORE UPDATE ON public.qa_fixtures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.role_permissions (role, permission) VALUES
  ('owner','demo.read'),('owner','demo.seed'),('owner','demo.reset'),('owner','qa.create'),('owner','qa.destroy'),('owner','qa.run'),
  ('administrator','demo.read'),('administrator','demo.seed'),('administrator','demo.reset'),('administrator','qa.create'),('administrator','qa.destroy'),('administrator','qa.run'),
  ('developer','demo.read'),('developer','qa.create'),('developer','qa.destroy'),('developer','qa.run'),
  ('operations','demo.read'),
  ('read_only','demo.read')
ON CONFLICT DO NOTHING;