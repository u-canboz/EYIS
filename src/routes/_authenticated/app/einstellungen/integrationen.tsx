/**
 * Integration Center — zentrale Bedienebene für externe Anbieter.
 * Verbinden, prüfen, testen und trennen ohne Codeänderung. Die Engines
 * (payments/, communications/, shipping/) bleiben führend; diese Seite
 * aggregiert ihren Status und verlinkt in die Detailkonfiguration.
 */
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2,
  CircleAlert,
  CircleOff,
  CreditCard,
  Globe,
  Loader2,
  Mail,
  Plug,
  RefreshCw,
  Send,
  Truck,
  Unplug,
} from "lucide-react";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import {
  addSenderDomainFn,
  connectIntegrationFn,
  disconnectIntegrationFn,
  getCredentialStatusFn,
  sendProviderTestEmailFn,
  getShopReadinessFn,
  listIntegrationsFn,
  listSenderDomainsFn,
  recheckSenderDomainFn,
  testConnectionFn,
} from "@/lib/commerce/integrations/integration.functions";
import {
  CATEGORY_LABELS,
  HEALTH_LABELS,
  INTEGRATION_STATUS_LABELS,
  type IntegrationCategory,
} from "@/lib/commerce/integrations/registry";
import type { IntegrationView, ReadinessArea } from "@/lib/commerce/integrations/integration.server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/einstellungen/integrationen")({
  head: () => ({
    meta: [
      { title: "Integrationen – Commerce OS" },
      {
        name: "description",
        content: "Payment-, E-Mail- und Versand-Anbieter zentral verbinden, prüfen und trennen.",
      },
      { property: "og:title", content: "Integrationen – Commerce OS" },
      { property: "og:description", content: "Zentrale Bedienebene für externe Anbieter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntegrationsPage,
});

const CATEGORY_ICONS: Record<IntegrationCategory, typeof CreditCard> = {
  payment: CreditCard,
  email: Mail,
  carrier: Truck,
};

function StatusBadge({ status }: { status: IntegrationView["status"] }) {
  const variant =
    status === "connected"
      ? "default"
      : status === "not_connected" || status === "disabled"
        ? "secondary"
        : "destructive";
  return (
    <Badge variant={variant} className="shrink-0">
      {INTEGRATION_STATUS_LABELS[status]}
    </Badge>
  );
}

function ReadinessCard({ area }: { area: ReadinessArea }) {
  const Icon = area.liveReady ? CheckCircle2 : area.ready ? CircleAlert : CircleOff;
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-border p-4">
      <Icon
        className={`mt-0.5 size-5 shrink-0 ${
          area.liveReady
            ? "text-emerald-600 dark:text-emerald-400"
            : area.ready
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
        }`}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-sm font-medium">{area.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{area.detail}</p>
      </div>
    </div>
  );
}

type CredentialField = {
  name: string;
  label: string;
  placeholder: string;
  help: string;
  required: boolean;
  /** Geheimnisse bleiben verdeckt; Adressen und Ports sind sichtbar. */
  kind?: "secret" | "text" | "number" | "choice";
  options?: { value: string; label: string }[];
  defaultValue?: string;
};

const CREDENTIAL_FIELDS: Record<string, CredentialField[]> = {
  stripe: [
    {
      name: "secretKey",
      label: "Geheimer Stripe-Schlüssel",
      placeholder: "sk_test_…",
      help: "Aus dem Stripe-Dashboard unter Entwickler → API-Schlüssel. sk_test_ verbindet den Testmodus, sk_live_ den Live-Modus.",
      required: true,
    },
    {
      name: "webhookSecret",
      label: "Webhook-Secret",
      placeholder: "whsec_…",
      help: "Aus dem Stripe-Webhook-Endpunkt. Ohne dieses Secret werden Zahlungen nicht automatisch bestätigt.",
      required: false,
    },
  ],
  resend: [
    {
      name: "apiKey",
      label: "Resend-API-Schlüssel",
      placeholder: "re_…",
      help: "Aus dem Resend-Dashboard unter API Keys (Berechtigung: Full access für Domain-Verwaltung).",
      required: true,
    },
    {
      name: "webhookSecret",
      label: "Webhook-Secret",
      placeholder: "whsec_…",
      help: "Aus dem Resend-Webhook. Ohne dieses Secret werden Bounces und Beschwerden nicht übernommen.",
      required: false,
    },
  ],
  paypal: [
    {
      name: "environment",
      label: "Umgebung",
      placeholder: "",
      help: "Sandbox zum Testen, Live für echte Zahlungen. Die Zugangsdaten unterscheiden sich.",
      required: true,
      kind: "choice",
      defaultValue: "test",
      options: [
        { value: "test", label: "Sandbox (Test)" },
        { value: "live", label: "Live" },
      ],
    },
    {
      name: "clientId",
      label: "Client-ID",
      placeholder: "A21AA…",
      help: "Aus dem PayPal-Entwicklerportal unter Apps & Credentials.",
      required: true,
      kind: "text",
    },
    {
      name: "clientSecret",
      label: "Secret",
      placeholder: "EL…",
      help: "Das Secret derselben PayPal-App. Wird verschlüsselt gespeichert.",
      required: true,
    },
    {
      name: "webhookId",
      label: "Webhook-ID",
      placeholder: "WH-…",
      help: "Aus dem in PayPal angelegten Webhook. Ohne sie werden Zahlungen nicht automatisch bestätigt.",
      required: false,
      kind: "text",
    },
  ],
  mollie: [
    {
      name: "apiKey",
      label: "Mollie-API-Schlüssel",
      placeholder: "test_… oder live_…",
      help: "Aus dem Mollie-Dashboard unter Entwickler → API-Schlüssel. Der Präfix bestimmt Test- oder Live-Betrieb.",
      required: true,
    },
  ],
  smtp: [
    {
      name: "host",
      label: "SMTP-Host",
      placeholder: "mail.ihre-domain.de",
      help: "Adresse Ihres Mailservers.",
      required: true,
      kind: "text",
    },
    {
      name: "port",
      label: "Port",
      placeholder: "587",
      help: "587 für STARTTLS, 465 für direktes TLS.",
      required: true,
      kind: "number",
      defaultValue: "587",
    },
    {
      name: "encryption",
      label: "Verschlüsselung",
      placeholder: "",
      help: "Unverschlüsselter Versand ist nicht möglich.",
      required: true,
      kind: "choice",
      defaultValue: "starttls",
      options: [
        { value: "starttls", label: "STARTTLS (Port 587)" },
        { value: "tls", label: "Direktes TLS (Port 465)" },
      ],
    },
    {
      name: "username",
      label: "Benutzername",
      placeholder: "versand@ihre-domain.de",
      help: "Anmeldename Ihres Mailkontos.",
      required: true,
      kind: "text",
    },
    {
      name: "password",
      label: "Passwort",
      placeholder: "",
      help: "Wird verschlüsselt gespeichert und nie wieder angezeigt.",
      required: true,
    },
    {
      name: "senderAddress",
      label: "Absenderadresse",
      placeholder: "shop@ihre-domain.de",
      help: "Diese Adresse steht im Absender aller Shop-E-Mails.",
      required: true,
      kind: "text",
    },
    {
      name: "senderName",
      label: "Absendername",
      placeholder: "Mein Shop",
      help: "Angezeigter Name im Postfach der Kundschaft.",
      required: false,
      kind: "text",
    },
    {
      name: "replyTo",
      label: "Antwortadresse",
      placeholder: "service@ihre-domain.de",
      help: "Optional. Antworten der Kundschaft gehen an diese Adresse.",
      required: false,
      kind: "text",
    },
  ],
};

function ConnectDialog({
  view,
  open,
  onOpenChange,
}: {
  view: IntegrationView;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { organizationId, shopId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const connect = useServerFn(connectIntegrationFn);
  const fetchStatus = useServerFn(getCredentialStatusFn);
  const fields = CREDENTIAL_FIELDS[view.id] ?? [];
  const [values, setValues] = useState<Record<string, string>>({});

  const statusQuery = useQuery({
    queryKey: ["credential-status", organizationId, shopId, view.id],
    queryFn: () =>
      fetchStatus({
        data: { organizationId, shopId, category: view.category, provider: view.id },
      }),
    enabled: open && !!organizationId && !!shopId,
  });

  const mutation = useMutation({
    mutationFn: () =>
      connect({
        data: {
          organizationId,
          shopId,
          category: view.category,
          provider: view.id,
          values,
        },
      }),
    onSuccess: (result) => {
      toast.success(result.message);
      setValues({});
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["integrations", organizationId, shopId] });
      void queryClient.invalidateQueries({ queryKey: ["shop-readiness", organizationId, shopId] });
      void queryClient.invalidateQueries({ queryKey: ["credential-status"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const required = fields.filter((f) => f.required);
  const canSubmit = required.every((f) => (values[f.name] ?? "").trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{view.displayName} verbinden</DialogTitle>
          <DialogDescription>
            Die Zugangsdaten werden verschlüsselt und ausschließlich serverseitig gespeichert. Sie
            werden nach dem Speichern nie wieder angezeigt.
          </DialogDescription>
        </DialogHeader>

        {statusQuery.data?.connected ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground text-pretty">
            Bereits hinterlegt:{" "}
            {Object.entries(statusQuery.data.hints)
              .map(([key, value]) => `${key}: ${value}`)
              .join(" · ")}
            . Neue Eingaben ersetzen die bisherigen Zugangsdaten.
          </p>
        ) : null}

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) mutation.mutate();
          }}
        >
          {fields.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <Label htmlFor={`${view.id}-${field.name}`}>
                {field.label}
                {field.required ? "" : " (optional)"}
              </Label>
              <Input
                id={`${view.id}-${field.name}`}
                type="password"
                autoComplete="off"
                spellCheck={false}
                className="h-11"
                placeholder={field.placeholder}
                value={values[field.name] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground text-pretty">{field.help}</p>
            </div>
          ))}

          {statusQuery.data?.webhookUrl ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${view.id}-webhook-url`}>Webhook-URL für {view.displayName}</Label>
              <Input
                id={`${view.id}-webhook-url`}
                readOnly
                className="h-11 font-mono text-xs"
                value={statusQuery.data.webhookUrl}
                onFocus={(e) => e.currentTarget.select()}
              />
              <p className="text-xs text-muted-foreground text-pretty">
                Diese Adresse beim Anbieter als Webhook-Ziel eintragen.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" className="h-11" disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plug className="size-4" aria-hidden />
              )}
              Prüfen und verbinden
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IntegrationCard({ view }: { view: IntegrationView }) {
  const { organizationId, shopId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const runTest = useServerFn(testConnectionFn);
  const runDisconnect = useServerFn(disconnectIntegrationFn);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const supportsCredentials = !!CREDENTIAL_FIELDS[view.id] && view.implemented;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["integrations", organizationId, shopId] });

  const testMutation = useMutation({
    mutationFn: () =>
      runTest({ data: { organizationId, shopId, category: view.category, provider: view.id } }),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      void invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () =>
      runDisconnect({
        data: { organizationId, shopId, category: view.category, provider: view.id },
      }),
    onSuccess: () => {
      toast.success(`${view.displayName} wurde getrennt.`);
      setConfirmDisconnect(false);
      void invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const CategoryIcon = CATEGORY_ICONS[view.category];

  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
            <CategoryIcon className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="font-medium text-pretty">{view.displayName}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
              {view.description}
            </p>
          </div>
        </div>
        <StatusBadge status={view.status} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-muted-foreground">Umgebung</dt>
        <dd className="text-right font-medium">
          {view.environment ? (view.environment === "live" ? "Live" : "Test") : "—"}
        </dd>
        <dt className="text-muted-foreground">Verbindung</dt>
        <dd className="text-right font-medium">{view.connectionType}</dd>
        {view.health ? (
          <>
            <dt className="text-muted-foreground">Letzte Prüfung</dt>
            <dd className="text-right font-medium">
              {HEALTH_LABELS[view.health.status]}
              {view.health.lastCheckedAt
                ? ` · ${new Date(view.health.lastCheckedAt).toLocaleString("de-DE")}`
                : ""}
            </dd>
          </>
        ) : null}
      </dl>

      {view.testOnly ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground text-pretty">
          Nur für Tests und Demo — nicht für den Live-Betrieb.
        </p>
      ) : null}
      {view.note ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground text-pretty">
          {view.note}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2">
        {view.managePath ? (
          <Button asChild variant="outline" className="h-11">
            <Link to={view.managePath}>Konfigurieren</Link>
          </Button>
        ) : null}
        {supportsCredentials ? (
          <Button className="h-11" onClick={() => setConnectOpen(true)}>
            <Plug className="size-4" aria-hidden />
            {view.status === "connected" ? "Zugangsdaten ersetzen" : "Verbinden"}
          </Button>
        ) : null}
        {view.implemented && view.status !== "connected" && !supportsCredentials ? (
          <Button
            className="h-11"
            disabled={testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            {testMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plug className="size-4" aria-hidden />
            )}
            Verbindung prüfen
          </Button>
        ) : null}
        {view.implemented && view.status === "connected" ? (
          <Button
            variant="outline"
            className="h-11"
            disabled={testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            {testMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            Erneut testen
          </Button>
        ) : null}
        {view.status === "connected" && view.implemented ? (
          <Button variant="destructive" className="h-11" onClick={() => setConfirmDisconnect(true)}>
            <Unplug className="size-4" aria-hidden />
            Trennen
          </Button>
        ) : null}
        {!view.implemented ? (
          <Badge variant="secondary" className="self-center">
            Noch nicht verfügbar
          </Badge>
        ) : null}
      </div>

      {supportsCredentials ? (
        <ConnectDialog view={view} open={connectOpen} onOpenChange={setConnectOpen} />
      ) : null}

      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{view.displayName} trennen?</DialogTitle>
            <DialogDescription>
              Die Konfiguration wird deaktiviert und die hinterlegten Zugangsdaten werden
              vollständig gelöscht. Zum erneuten Verbinden ist ein neuer Schlüssel nötig.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => setConfirmDisconnect(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              className="h-11"
              disabled={disconnectMutation.isPending}
              onClick={() => disconnectMutation.mutate()}
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Endgültig trennen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function SenderDomainsCard() {
  const { organizationId, shopId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const fetchDomains = useServerFn(listSenderDomainsFn);
  const addDomain = useServerFn(addSenderDomainFn);
  const recheck = useServerFn(recheckSenderDomainFn);
  const [domain, setDomain] = useState("");

  const domainsQuery = useQuery({
    queryKey: ["sender-domains", organizationId, shopId],
    queryFn: () => fetchDomains({ data: { organizationId, shopId } }),
    enabled: !!organizationId && !!shopId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["sender-domains", organizationId, shopId] });

  const addMutation = useMutation({
    mutationFn: () => addDomain({ data: { organizationId, shopId, domain } }),
    onSuccess: () => {
      toast.success("Absenderdomain angelegt.");
      setDomain("");
      void invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const recheckMutation = useMutation({
    mutationFn: (domainId: string) =>
      recheck({ data: { organizationId, shopId, domainId } }),
    onSuccess: (result) => {
      if (result.verified) toast.success(result.message);
      else toast.info(result.message);
      void invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <section className="min-w-0 space-y-4 rounded-2xl border border-border p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
          <Globe className="size-5 text-muted-foreground" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-medium text-pretty">Absenderdomains</h2>
          <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
            Eine Domain gilt erst als verifiziert, wenn der verbundene Anbieter dies bestätigt.
          </p>
        </div>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (domain.trim()) addMutation.mutate();
        }}
      >
        <Input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="news.deinshop.de"
          className="h-11 flex-1"
          aria-label="Neue Absenderdomain"
        />
        <Button type="submit" className="h-11" disabled={addMutation.isPending || !domain.trim()}>
          {addMutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Domain hinzufügen
        </Button>
      </form>

      {domainsQuery.isLoading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : (domainsQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Absenderdomain hinterlegt.</p>
      ) : (
        <ul className="divide-y divide-border">
          {(domainsQuery.data ?? []).map((d) => (
            <li
              key={d.id}
              className="flex min-w-0 flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.domain}</p>
                <p className="text-xs text-muted-foreground">
                  Status: {d.status}
                  {d.verifiedAt
                    ? ` · verifiziert am ${new Date(d.verifiedAt).toLocaleDateString("de-DE")}`
                    : ""}
                </p>
              </div>
              {d.dnsRecords.length > 0 ? (
                <details className="min-w-0 sm:max-w-md">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    DNS-Einträge anzeigen ({d.dnsRecords.length})
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {d.dnsRecords.map((record) => (
                      <li
                        key={`${record.type}-${record.name}`}
                        className="rounded-lg bg-muted p-2 text-[11px] break-all"
                      >
                        <span className="font-medium">{record.type}</span> · {record.name}
                        <br />
                        <span className="font-mono">{record.value}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {d.status !== "verified" ? (
                <Button
                  variant="outline"
                  className="h-11 shrink-0"
                  disabled={recheckMutation.isPending}
                  onClick={() => recheckMutation.mutate(d.id)}
                >
                  Prüfung anfordern
                </Button>
              ) : (
                <Badge>Verifiziert</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TestEmailCard() {
  const { organizationId, shopId } = useActiveWorkspace();
  const send = useServerFn(sendProviderTestEmailFn);
  const [recipient, setRecipient] = useState("");

  const mutation = useMutation({
    mutationFn: () => send({ data: { organizationId, shopId, recipient } }),
    onSuccess: (result) => {
      if (result.sent) toast.success(result.message);
      else toast.warning(result.message);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <section className="min-w-0 space-y-4 rounded-2xl border border-border p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
          <Send className="size-5 text-muted-foreground" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-medium text-pretty">Test-E-Mail senden</h2>
          <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
            Sendet über den aktiven Anbieter dieses Shops — genau denselben Weg wie Bestellmails.
          </p>
        </div>
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (recipient.trim()) mutation.mutate();
        }}
      >
        <Input
          type="email"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="name@beispiel.de"
          className="h-11 flex-1"
          aria-label="Empfängeradresse für die Test-E-Mail"
        />
        <Button type="submit" className="h-11" disabled={mutation.isPending || !recipient.trim()}>
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Test-E-Mail senden
        </Button>
      </form>
    </section>
  );
}

function IntegrationsPage() {
  const { organizationId, shopId, isLoading: workspaceLoading } = useActiveWorkspace();
  const fetchIntegrations = useServerFn(listIntegrationsFn);
  const fetchReadiness = useServerFn(getShopReadinessFn);
  const [category, setCategory] = useState<IntegrationCategory>("payment");

  const integrationsQuery = useQuery({
    queryKey: ["integrations", organizationId, shopId],
    queryFn: () => fetchIntegrations({ data: { organizationId, shopId } }),
    enabled: !!organizationId && !!shopId,
  });
  const readinessQuery = useQuery({
    queryKey: ["shop-readiness", organizationId, shopId],
    queryFn: () => fetchReadiness({ data: { organizationId, shopId } }),
    enabled: !!organizationId && !!shopId,
  });

  const loading = workspaceLoading || integrationsQuery.isLoading;
  const integrations = (integrationsQuery.data ?? []).filter((v) => v.category === category);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="min-w-0">
        <h1 className="text-2xl font-semibold text-balance">Integrationen</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Anbieter auswählen, verbinden, Konfiguration prüfen, Verbindung testen und aktivieren —
          ohne Codeänderung.
        </p>
      </header>

      <section aria-labelledby="readiness-heading" className="mt-6">
        <h2 id="readiness-heading" className="text-sm font-medium text-muted-foreground">
          Shop-Readiness
        </h2>
        {readinessQuery.isLoading ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(readinessQuery.data?.areas ?? []).map((area) => (
              <ReadinessCard key={area.key} area={area} />
            ))}
          </div>
        )}
      </section>

      <nav aria-label="Integrationskategorien" className="mt-8">
        <ul className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_LABELS) as IntegrationCategory[]).map((c) => {
            const Icon = CATEGORY_ICONS[c];
            const active = c === category;
            return (
              <li key={c}>
                <Button
                  variant={active ? "default" : "outline"}
                  className="h-11"
                  aria-pressed={active}
                  onClick={() => setCategory(c)}
                >
                  <Icon className="size-4" aria-hidden />
                  {CATEGORY_LABELS[c]}
                </Button>
              </li>
            );
          })}
        </ul>
      </nav>

      {loading ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {integrations.map((view) => (
            <IntegrationCard key={view.id} view={view} />
          ))}
        </div>
      )}

      {category === "email" ? (
        <div className="mt-6 space-y-6">
          <SenderDomainsCard />
          <TestEmailCard />
        </div>
      ) : null}
    </div>
  );
}
