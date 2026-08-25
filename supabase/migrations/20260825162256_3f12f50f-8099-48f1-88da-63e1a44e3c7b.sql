-- ========== ENUMS ==========
CREATE TYPE public.document_type AS ENUM (
  'invoice','credit_note','delivery_note',
  'proforma_invoice','quote','return_document','payment_receipt','cancellation_document'
);
CREATE TYPE public.invoice_status AS ENUM ('draft','issued','partially_credited','credited','voided');
CREATE TYPE public.credit_note_status AS ENUM ('draft','issued','voided');
CREATE TYPE public.delivery_note_status AS ENUM ('draft','issued','voided');
CREATE TYPE public.document_format AS ENUM ('pdf','zugferd','xrechnung','ubl');
CREATE TYPE public.document_format_status AS ENUM ('not_generated','generated','validation_failed');
CREATE TYPE public.sequence_reset_policy AS ENUM ('never','yearly','monthly');
CREATE TYPE public.invoice_item_type AS ENUM ('product','shipping','discount','custom');
CREATE TYPE public.invoice_creation_strategy AS ENUM ('manual','on_order_paid','on_order_created');

-- ========== SEQUENCES ==========
CREATE TABLE public.document_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  document_type public.document_type NOT NULL,
  prefix text NOT NULL DEFAULT 'RE',
  suffix text,
  next_number bigint NOT NULL DEFAULT 1,
  padding integer NOT NULL DEFAULT 6,
  reset_policy public.sequence_reset_policy NOT NULL DEFAULT 'yearly',
  current_period text,
  include_period boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, document_type)
);

-- ========== INVOICES ==========
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  invoice_number text,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  currency_code text NOT NULL,
  issue_date date,
  service_date date,
  due_date date,
  customer_type public.tax_customer_type NOT NULL DEFAULT 'consumer',
  customer_email text,
  customer_name text,
  customer_company text,
  customer_vat_id text,
  billing_address_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  seller_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  branding_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  subtotal_net_minor bigint NOT NULL DEFAULT 0,
  discount_minor bigint NOT NULL DEFAULT 0,
  shipping_net_minor bigint NOT NULL DEFAULT 0,
  tax_total_minor bigint NOT NULL DEFAULT 0,
  total_gross_minor bigint NOT NULL DEFAULT 0,
  paid_minor bigint NOT NULL DEFAULT 0,
  credited_minor bigint NOT NULL DEFAULT 0,
  tax_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  tax_engine_version text,
  source_order_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  buyer_reference text,
  purchase_order_reference text,
  contract_reference text,
  payment_terms text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  issued_by uuid,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  issued_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, invoice_number)
);
CREATE UNIQUE INDEX invoices_one_active_per_order
  ON public.invoices (order_id) WHERE status <> 'voided';
CREATE INDEX invoices_org_status_idx ON public.invoices (organization_id, status, created_at DESC);

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  position integer NOT NULL,
  item_type public.invoice_item_type NOT NULL DEFAULT 'product',
  product_name text NOT NULL,
  variant_name text,
  sku text,
  description text,
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'C62',
  unit_net_minor bigint NOT NULL DEFAULT 0,
  discount_minor bigint NOT NULL DEFAULT 0,
  line_net_minor bigint NOT NULL DEFAULT 0,
  tax_rate_basis_points integer NOT NULL DEFAULT 0,
  tax_reason_code text NOT NULL DEFAULT 'standard_rate',
  tax_minor bigint NOT NULL DEFAULT 0,
  line_gross_minor bigint NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, position)
);

-- ========== CREDIT NOTES ==========
CREATE TABLE public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  refund_id uuid REFERENCES public.refunds(id) ON DELETE SET NULL,
  credit_note_number text,
  status public.credit_note_status NOT NULL DEFAULT 'draft',
  currency_code text NOT NULL,
  reason text,
  subtotal_net_minor bigint NOT NULL DEFAULT 0,
  tax_total_minor bigint NOT NULL DEFAULT 0,
  total_gross_minor bigint NOT NULL DEFAULT 0,
  seller_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  branding_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  tax_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  issued_by uuid,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  issued_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, credit_note_number)
);
CREATE INDEX credit_notes_invoice_idx ON public.credit_notes (invoice_id);

CREATE TABLE public.credit_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  credit_note_id uuid NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  invoice_item_id uuid REFERENCES public.invoice_items(id) ON DELETE SET NULL,
  position integer NOT NULL,
  item_type public.invoice_item_type NOT NULL DEFAULT 'product',
  product_name text NOT NULL,
  variant_name text,
  sku text,
  description text,
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'C62',
  unit_net_minor bigint NOT NULL DEFAULT 0,
  line_net_minor bigint NOT NULL DEFAULT 0,
  tax_rate_basis_points integer NOT NULL DEFAULT 0,
  tax_reason_code text NOT NULL DEFAULT 'standard_rate',
  tax_minor bigint NOT NULL DEFAULT 0,
  line_gross_minor bigint NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (credit_note_id, position)
);

-- ========== DELIVERY NOTES ==========
CREATE TABLE public.delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  fulfillment_id uuid REFERENCES public.fulfillments(id) ON DELETE SET NULL,
  document_number text,
  status public.delivery_note_status NOT NULL DEFAULT 'draft',
  recipient_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  seller_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  branding_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  issued_by uuid,
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, document_number)
);

-- ========== DOCUMENT FILES ==========
CREATE TABLE public.document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  document_type public.document_type NOT NULL,
  document_id uuid NOT NULL,
  format public.document_format NOT NULL DEFAULT 'pdf',
  status public.document_format_status NOT NULL DEFAULT 'generated',
  version integer NOT NULL DEFAULT 1,
  renderer_version text,
  storage_path text,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  file_size integer,
  checksum text,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, format, version)
);
CREATE INDEX document_files_doc_idx ON public.document_files (document_id, format, version DESC);

-- ========== BRANDING & SETTINGS ==========
CREATE TABLE public.document_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  preset text NOT NULL DEFAULT 'clean',
  logo_media_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  primary_color text NOT NULL DEFAULT '#1F2937',
  secondary_color text,
  font_family text NOT NULL DEFAULT 'helvetica',
  sender_block text,
  bank_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_details text,
  footer_text text,
  legal_footer text,
  show_product_sku boolean NOT NULL DEFAULT true,
  show_product_images boolean NOT NULL DEFAULT false,
  show_tax_breakdown boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id)
);

CREATE TABLE public.invoice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  company_name text,
  legal_form text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country_code text NOT NULL DEFAULT 'DE',
  tax_number text,
  vat_id text,
  register_court text,
  register_number text,
  managing_director text,
  contact_email text,
  contact_phone text,
  website text,
  bank_account_holder text,
  bank_iban text,
  bank_bic text,
  bank_name text,
  payment_terms_days integer NOT NULL DEFAULT 14,
  payment_terms_text text,
  invoice_creation_strategy public.invoice_creation_strategy NOT NULL DEFAULT 'on_order_paid',
  automatically_create_invoice boolean NOT NULL DEFAULT false,
  automatically_issue_invoice boolean NOT NULL DEFAULT false,
  credit_note_draft_on_refund boolean NOT NULL DEFAULT false,
  einvoice_zugferd_enabled boolean NOT NULL DEFAULT false,
  einvoice_xrechnung_enabled boolean NOT NULL DEFAULT false,
  leitweg_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id)
);

-- ========== GRANTS ==========
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_sequences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_note_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_branding TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_settings TO authenticated;
GRANT ALL ON public.document_sequences TO service_role;
GRANT ALL ON public.invoices TO service_role;
GRANT ALL ON public.invoice_items TO service_role;
GRANT ALL ON public.credit_notes TO service_role;
GRANT ALL ON public.credit_note_items TO service_role;
GRANT ALL ON public.delivery_notes TO service_role;
GRANT ALL ON public.document_files TO service_role;
GRANT ALL ON public.document_branding TO service_role;
GRANT ALL ON public.invoice_settings TO service_role;

-- ========== RLS ==========
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_read ON public.invoices FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.read'));
CREATE POLICY invoices_write ON public.invoices FOR ALL TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.manage'))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'invoices.manage') AND shop_in_org(shop_id, organization_id));

CREATE POLICY invoice_items_read ON public.invoice_items FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.read'));
CREATE POLICY invoice_items_write ON public.invoice_items FOR ALL TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.manage'))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'invoices.manage'));

CREATE POLICY credit_notes_read ON public.credit_notes FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.read'));
CREATE POLICY credit_notes_write ON public.credit_notes FOR ALL TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.credit'))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'invoices.credit') AND shop_in_org(shop_id, organization_id));

CREATE POLICY credit_note_items_read ON public.credit_note_items FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.read'));
CREATE POLICY credit_note_items_write ON public.credit_note_items FOR ALL TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.credit'))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'invoices.credit'));

CREATE POLICY delivery_notes_read ON public.delivery_notes FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.read')
     OR has_permission(auth.uid(), organization_id, 'fulfillment.read'));
CREATE POLICY delivery_notes_write ON public.delivery_notes FOR ALL TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.manage'))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'invoices.manage') AND shop_in_org(shop_id, organization_id));

CREATE POLICY document_files_read ON public.document_files FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.read'));
CREATE POLICY document_files_write ON public.document_files FOR ALL TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.manage'))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'invoices.manage'));

CREATE POLICY document_sequences_read ON public.document_sequences FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY document_sequences_write ON public.document_sequences FOR ALL TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'documents.settings'))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'documents.settings') AND shop_in_org(shop_id, organization_id));

CREATE POLICY document_branding_read ON public.document_branding FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY document_branding_write ON public.document_branding FOR ALL TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'documents.settings'))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'documents.settings') AND shop_in_org(shop_id, organization_id));

CREATE POLICY invoice_settings_read ON public.invoice_settings FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY invoice_settings_write ON public.invoice_settings FOR ALL TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'documents.settings'))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'documents.settings') AND shop_in_org(shop_id, organization_id));

-- ========== IMMUTABILITY ==========
CREATE OR REPLACE FUNCTION public.invoice_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Ausgestellte Rechnungen können nicht gelöscht werden.';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'draft' THEN RETURN NEW; END IF;
  IF NEW.status = 'draft' THEN
    RAISE EXCEPTION 'Eine ausgestellte Rechnung kann nicht zurück auf Entwurf gesetzt werden.';
  END IF;
  IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
     OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
     OR NEW.total_gross_minor IS DISTINCT FROM OLD.total_gross_minor
     OR NEW.tax_total_minor IS DISTINCT FROM OLD.tax_total_minor
     OR NEW.subtotal_net_minor IS DISTINCT FROM OLD.subtotal_net_minor
     OR NEW.seller_snapshot IS DISTINCT FROM OLD.seller_snapshot
     OR NEW.billing_address_snapshot IS DISTINCT FROM OLD.billing_address_snapshot
     OR NEW.tax_breakdown IS DISTINCT FROM OLD.tax_breakdown
     OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
     OR NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    RAISE EXCEPTION 'Fachliche Rechnungsdaten sind nach der Ausstellung unveränderbar.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER invoices_guard BEFORE UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoice_guard();

CREATE OR REPLACE FUNCTION public.invoice_items_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s public.invoice_status;
BEGIN
  SELECT status INTO s FROM public.invoices
   WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF s IS NOT NULL AND s <> 'draft' THEN
    RAISE EXCEPTION 'Positionen einer ausgestellten Rechnung sind unveränderbar.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER invoice_items_guard BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.invoice_items_guard();

CREATE OR REPLACE FUNCTION public.credit_note_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Ausgestellte Gutschriften können nicht gelöscht werden.';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'draft' THEN RETURN NEW; END IF;
  IF NEW.status = 'draft' THEN
    RAISE EXCEPTION 'Eine ausgestellte Gutschrift kann nicht zurück auf Entwurf gesetzt werden.';
  END IF;
  IF NEW.credit_note_number IS DISTINCT FROM OLD.credit_note_number
     OR NEW.total_gross_minor IS DISTINCT FROM OLD.total_gross_minor
     OR NEW.tax_total_minor IS DISTINCT FROM OLD.tax_total_minor
     OR NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
    RAISE EXCEPTION 'Fachliche Gutschriftdaten sind nach der Ausstellung unveränderbar.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER credit_notes_guard BEFORE UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.credit_note_guard();

CREATE OR REPLACE FUNCTION public.document_files_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Dokumentdateien sind unveränderbar. Erzeuge eine neue Version.';
END; $$;
CREATE TRIGGER document_files_guard BEFORE UPDATE ON public.document_files
  FOR EACH ROW EXECUTE FUNCTION public.document_files_guard();

CREATE TRIGGER document_sequences_touch BEFORE UPDATE ON public.document_sequences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER invoices_touch BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER credit_notes_touch BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER delivery_notes_touch BEFORE UPDATE ON public.delivery_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER document_branding_touch BEFORE UPDATE ON public.document_branding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER invoice_settings_touch BEFORE UPDATE ON public.invoice_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== PERMISSIONS ==========
INSERT INTO public.role_permissions (role, permission) VALUES
  ('owner','invoices.read'),('owner','invoices.manage'),('owner','invoices.credit'),('owner','documents.settings'),
  ('administrator','invoices.read'),('administrator','invoices.manage'),('administrator','invoices.credit'),('administrator','documents.settings'),
  ('finance','invoices.read'),('finance','invoices.manage'),('finance','invoices.credit'),('finance','documents.settings'),
  ('operations','invoices.read'),('operations','invoices.manage'),
  ('customer_support','invoices.read'),
  ('fulfillment','invoices.read'),
  ('read_only','invoices.read'),
  ('developer','invoices.read')
ON CONFLICT DO NOTHING;

-- ========== STORAGE POLICIES ==========
CREATE POLICY documents_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.current_org_ids()));
CREATE POLICY documents_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.current_org_ids()));