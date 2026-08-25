import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getDocumentSetupFn,
  saveInvoiceSettingsFn,
  saveBrandingFn,
  saveSequenceFn,
} from "@/lib/commerce/documents/document.functions";
import {
  CREATION_STRATEGY_LABELS,
  DOCUMENT_TYPE_LABELS,
  SEQUENCE_RESET_LABELS,
  SETUP_LABELS,
  type DocumentType,
  type SequenceResetPolicy,
} from "@/lib/commerce/documents/document.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/dokumente/einstellungen")({
  head: () => ({
    meta: [
      { title: "Dokumenteinstellungen – Commerce OS" },
      {
        name: "description",
        content:
          "Unternehmensdaten, Bankverbindung, Zahlungsziel, Nummernkreise und Layout für Rechnungen und Lieferscheine.",
      },
      { property: "og:title", content: "Dokumenteinstellungen – Commerce OS" },
      { property: "og:description", content: "Rechnungsdaten, Nummernkreise und Dokumentlayout einrichten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentSettingsPage,
});

const SEQUENCE_TYPES: DocumentType[] = ["invoice", "credit_note", "delivery_note"];

type SettingsDraft = Record<string, string | number | boolean | null>;

function DocumentSettingsPage() {
  const { organizationId, shopId, can } = useActiveWorkspace();
  const queryClient = useQueryClient();

  const getSetup = useServerFn(getDocumentSetupFn);
  const saveSettings = useServerFn(saveInvoiceSettingsFn);
  const saveBranding = useServerFn(saveBrandingFn);
  const saveSequence = useServerFn(saveSequenceFn);

  const setup = useQuery({
    queryKey: ["document-setup", organizationId, shopId],
    enabled: !!organizationId && !!shopId,
    queryFn: () => getSetup({ data: { organizationId, shopId } }),
  });

  const [settings, setSettings] = useState<SettingsDraft>({});
  const [branding, setBranding] = useState<SettingsDraft>({});

  useEffect(() => {
    const s = setup.data?.settings;
    if (s) {
      setSettings({
        company_name: s.companyName ?? "",
        legal_form: s.legalForm ?? "",
        address_line1: s.addressLine1 ?? "",
        address_line2: s.addressLine2 ?? "",
        postal_code: s.postalCode ?? "",
        city: s.city ?? "",
        country_code: s.countryCode,
        tax_number: s.taxNumber ?? "",
        vat_id: s.vatId ?? "",
        register_court: s.registerCourt ?? "",
        register_number: s.registerNumber ?? "",
        managing_director: s.managingDirector ?? "",
        contact_email: s.contactEmail ?? "",
        contact_phone: s.contactPhone ?? "",
        website: s.website ?? "",
        bank_account_holder: s.bankAccountHolder ?? "",
        bank_iban: s.bankIban ?? "",
        bank_bic: s.bankBic ?? "",
        bank_name: s.bankName ?? "",
        payment_terms_days: s.paymentTermsDays,
        invoice_creation_strategy: s.invoiceCreationStrategy,
        automatically_create_invoice: s.automaticallyCreateInvoice,
        automatically_issue_invoice: s.automaticallyIssueInvoice,
        credit_note_draft_on_refund: s.creditNoteDraftOnRefund,
        einvoice_zugferd_enabled: s.einvoiceZugferdEnabled,
        einvoice_xrechnung_enabled: s.einvoiceXrechnungEnabled,
        leitweg_id: s.leitwegId ?? "",
      });
    }
    const b = setup.data?.branding;
    if (b) {
      setBranding({
        preset: b.preset,
        primary_color: b.primaryColor,
        sender_block: b.senderBlock ?? "",
        payment_details: b.paymentDetails ?? "",
        footer_text: b.footerText ?? "",
        legal_footer: b.legalFooter ?? "",
        show_product_sku: b.showProductSku,
        show_tax_breakdown: b.showTaxBreakdown,
      });
    }
  }, [setup.data]);

  const fail = (e: Error) => toast.error(e.message);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["document-setup", organizationId, shopId] });

  const settingsMutation = useMutation({
    mutationFn: () => saveSettings({ data: { organizationId, shopId, values: settings } }),
    onSuccess: () => {
      toast.success("Rechnungsdaten gespeichert.");
      refresh();
    },
    onError: fail,
  });

  const brandingMutation = useMutation({
    mutationFn: () => saveBranding({ data: { organizationId, shopId, values: branding } }),
    onSuccess: () => {
      toast.success("Layout gespeichert.");
      refresh();
    },
    onError: fail,
  });

  const sequenceMutation = useMutation({
    mutationFn: (input: {
      documentType: string;
      prefix: string;
      suffix: string | null;
      padding: number;
      resetPolicy: string;
      includePeriod: boolean;
      nextNumber?: number | null;
    }) => saveSequence({ data: { organizationId, shopId, ...input } }),
    onSuccess: () => {
      toast.success("Nummernkreis gespeichert.");
      refresh();
    },
    onError: fail,
  });

  if (setup.isLoading || !setup.data) return <Skeleton className="h-96 w-full" />;
  const disabled = !can("documents.settings");

  const field = (key: string, label: string, placeholder?: string) => (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        value={String(settings[key] ?? "")}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setSettings((p) => ({ ...p, [key]: e.target.value }))}
      />
    </div>
  );

  const toggle = (key: string, label: string, description: string) => (
    <div className="flex items-start justify-between gap-4 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <Switch
        checked={!!settings[key]}
        disabled={disabled}
        onCheckedChange={(v) => setSettings((p) => ({ ...p, [key]: v }))}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <header>
        <Link to="/app/dokumente" className="text-muted-foreground text-xs hover:underline">
          ← Dokumente
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Dokumenteinstellungen</h1>
        <p className="text-muted-foreground text-sm">
          Diese Angaben landen als unveränderbare Momentaufnahme auf jeder ausgestellten Rechnung.
        </p>
      </header>

      {!!setup.data.missing.length && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Noch offen</p>
          <ul className="text-muted-foreground mt-1 list-inside list-disc">
            {setup.data.missing.map((m) => (
              <li key={m}>{SETUP_LABELS[m] ?? m}</li>
            ))}
          </ul>
        </div>
      )}

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Unternehmen</TabsTrigger>
          <TabsTrigger value="sequences">Nummernkreise</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="automation">Automatisierung</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-4 pt-4">
          <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
            {field("company_name", "Firmenname", "Muster GmbH")}
            {field("legal_form", "Rechtsform", "GmbH")}
            {field("address_line1", "Straße und Hausnummer")}
            {field("address_line2", "Adresszusatz")}
            {field("postal_code", "PLZ")}
            {field("city", "Ort")}
            {field("country_code", "Land (ISO)", "DE")}
            {field("managing_director", "Geschäftsführung")}
            {field("tax_number", "Steuernummer")}
            {field("vat_id", "USt-IdNr.")}
            {field("register_court", "Registergericht")}
            {field("register_number", "Handelsregisternummer")}
            {field("contact_email", "E-Mail")}
            {field("contact_phone", "Telefon")}
            {field("website", "Website")}
          </section>

          <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
            <h2 className="col-span-full font-medium">Bankverbindung & Zahlungsziel</h2>
            {field("bank_account_holder", "Kontoinhaber")}
            {field("bank_name", "Bank")}
            {field("bank_iban", "IBAN")}
            {field("bank_bic", "BIC")}
            <div className="grid gap-1.5">
              <Label className="text-xs">Zahlungsziel in Tagen</Label>
              <Input
                type="number"
                min={0}
                value={String(settings['payment_terms_days'] ?? 14)}
                disabled={disabled}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, payment_terms_days: Number(e.target.value || 0) }))
                }
              />
            </div>
          </section>

          <Button disabled={disabled || settingsMutation.isPending} onClick={() => settingsMutation.mutate()}>
            Rechnungsdaten speichern
          </Button>
        </TabsContent>

        <TabsContent value="sequences" className="space-y-4 pt-4">
          {SEQUENCE_TYPES.map((type) => {
            const seq = setup.data.sequences.find((s) => s.documentType === type);
            return (
              <SequenceCard
                key={type}
                type={type}
                disabled={disabled || sequenceMutation.isPending}
                prefix={seq?.prefix ?? (type === "invoice" ? "RE" : type === "credit_note" ? "GS" : "LS")}
                suffix={seq?.suffix ?? ""}
                padding={seq?.padding ?? 6}
                resetPolicy={seq?.resetPolicy ?? "yearly"}
                includePeriod={seq?.includePeriod ?? true}
                nextNumber={seq?.nextNumber ?? 1}
                onSave={(v) => sequenceMutation.mutate({ documentType: type, ...v })}
              />
            );
          })}
        </TabsContent>

        <TabsContent value="layout" className="space-y-4 pt-4">
          <section className="grid gap-4 rounded-lg border p-4">
            <div className="grid gap-1.5 sm:max-w-xs">
              <Label className="text-xs">Akzentfarbe</Label>
              <Input
                value={String(branding['primary_color'] ?? "#1F2937")}
                disabled={disabled}
                onChange={(e) => setBranding((p) => ({ ...p, primary_color: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Absenderzeile über der Anschrift</Label>
              <Input
                value={String(branding['sender_block'] ?? "")}
                disabled={disabled}
                placeholder="Muster GmbH · Musterstraße 1 · 10115 Berlin"
                onChange={(e) => setBranding((p) => ({ ...p, sender_block: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Zahlungshinweis</Label>
              <Textarea
                rows={2}
                value={String(branding['payment_details'] ?? "")}
                disabled={disabled}
                onChange={(e) => setBranding((p) => ({ ...p, payment_details: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Fußzeile</Label>
              <Textarea
                rows={2}
                value={String(branding['legal_footer'] ?? "")}
                disabled={disabled}
                onChange={(e) => setBranding((p) => ({ ...p, legal_footer: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={branding['show_product_sku'] !== false}
                  disabled={disabled}
                  onCheckedChange={(v) => setBranding((p) => ({ ...p, show_product_sku: v }))}
                />
                Artikelnummern anzeigen
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={branding['show_tax_breakdown'] !== false}
                  disabled={disabled}
                  onCheckedChange={(v) => setBranding((p) => ({ ...p, show_tax_breakdown: v }))}
                />
                Steueraufschlüsselung anzeigen
              </label>
            </div>
          </section>
          <Button disabled={disabled || brandingMutation.isPending} onClick={() => brandingMutation.mutate()}>
            Layout speichern
          </Button>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4 pt-4">
          <section className="space-y-3 rounded-lg border p-4">
            <div className="grid gap-1.5 sm:max-w-sm">
              <Label className="text-xs">Wann soll eine Rechnung entstehen?</Label>
              <Select
                value={String(settings['invoice_creation_strategy'] ?? "on_order_paid")}
                disabled={disabled}
                onValueChange={(v) => setSettings((p) => ({ ...p, invoice_creation_strategy: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CREATION_STRATEGY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {toggle(
              "automatically_create_invoice",
              "Rechnungsentwurf automatisch anlegen",
              "Legt beim gewählten Auslöser automatisch einen Entwurf an.",
            )}
            {toggle(
              "automatically_issue_invoice",
              "Rechnung automatisch ausstellen",
              "Vergibt sofort eine Nummer und erzeugt das PDF.",
            )}
            {toggle(
              "credit_note_draft_on_refund",
              "Gutschriftentwurf bei Erstattung",
              "Erzeugt bei jeder Erstattung automatisch eine passende Gutschrift.",
            )}
            {toggle(
              "einvoice_zugferd_enabled",
              "ZUGFeRD vorbereiten",
              "Vormerkung für hybride E-Rechnungen. Die Erzeugung folgt später.",
            )}
            {toggle(
              "einvoice_xrechnung_enabled",
              "XRechnung vorbereiten",
              "Vormerkung für den Rechnungsaustausch mit öffentlichen Auftraggebern.",
            )}
            {field("leitweg_id", "Leitweg-ID (öffentliche Auftraggeber)")}
          </section>
          <Button disabled={disabled || settingsMutation.isPending} onClick={() => settingsMutation.mutate()}>
            Automatisierung speichern
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SequenceCard(props: {
  type: DocumentType;
  disabled: boolean;
  prefix: string;
  suffix: string;
  padding: number;
  resetPolicy: SequenceResetPolicy;
  includePeriod: boolean;
  nextNumber: number;
  onSave: (v: {
    prefix: string;
    suffix: string | null;
    padding: number;
    resetPolicy: string;
    includePeriod: boolean;
    nextNumber?: number | null;
  }) => void;
}) {
  const [prefix, setPrefix] = useState(props.prefix);
  const [padding, setPadding] = useState(props.padding);
  const [resetPolicy, setResetPolicy] = useState<SequenceResetPolicy>(props.resetPolicy);
  const [includePeriod, setIncludePeriod] = useState(props.includePeriod);
  const [nextNumber, setNextNumber] = useState(props.nextNumber);

  const period =
    resetPolicy === "yearly"
      ? new Date().getFullYear().toString()
      : resetPolicy === "monthly"
        ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
        : null;
  const preview = `${prefix}${includePeriod && period ? `-${period}` : ""}-${String(nextNumber).padStart(padding, "0")}`;

  return (
    <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
      <div className="col-span-full flex items-center justify-between">
        <h2 className="font-medium">{DOCUMENT_TYPE_LABELS[props.type]}</h2>
        <span className="text-muted-foreground font-mono text-xs">{preview}</span>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Präfix</Label>
        <Input value={prefix} disabled={props.disabled} onChange={(e) => setPrefix(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Stellen</Label>
        <Input
          type="number"
          min={1}
          max={12}
          value={padding}
          disabled={props.disabled}
          onChange={(e) => setPadding(Number(e.target.value || 1))}
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Rücksetzung</Label>
        <Select
          value={resetPolicy}
          disabled={props.disabled}
          onValueChange={(v) => setResetPolicy(v as SequenceResetPolicy)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SEQUENCE_RESET_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Nächste Nummer</Label>
        <Input
          type="number"
          min={1}
          value={nextNumber}
          disabled={props.disabled}
          onChange={(e) => setNextNumber(Number(e.target.value || 1))}
        />
      </div>
      <div className="flex items-end gap-3">
        <label className="flex items-center gap-2 pb-2 text-xs">
          <Switch checked={includePeriod} disabled={props.disabled} onCheckedChange={setIncludePeriod} />
          Zeitraum
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={props.disabled}
          onClick={() =>
            props.onSave({
              prefix,
              suffix: null,
              padding,
              resetPolicy,
              includePeriod,
              nextNumber,
            })
          }
        >
          Speichern
        </Button>
      </div>
    </section>
  );
}
