/**
 * Setup-Wizard für Dedicated Installationen (Phase 21): führt den Owner nach
 * dem Claim durch die verbleibende Einrichtung. Schritte werden in
 * commerce_installation.setup_state (Owner-restricted Server Table) persistiert.
 */
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  Building2,
  Globe,
  CreditCard,
  Mail,
  KeyRound,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { getInstallationStatus, saveSetupStep, setStorefrontOriginFn } from "@/lib/commerce/system/installation.functions";
import { getWorkspace } from "@/lib/commerce/workspace.functions";
import { useWorkspaceStore } from "@/lib/commerce/useWorkspaceStore";
import { PageHeader } from "@/components/shell/PageHeader";
import { EyisLogo } from "@/components/brand/EyisLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/system/einrichtung/")({
  head: () => ({
    meta: [
      { title: "Einrichtung – EYIS" },
      { name: "description", content: "Setup-Wizard: Organisation, Storefront, Payments, E-Mail und API für die eigene EYIS-Instanz einrichten." },
      { property: "og:title", content: "Einrichtung – EYIS" },
      { property: "og:description", content: "Geführte Einrichtung einer Dedicated-EYIS-Instanz." },
    ],
  }),
  component: SetupWizardPage,
});

interface WizardStep {
  key: string;
  title: string;
  description: string;
  icon: typeof Building2;
  action?: { label: string; to: string };
}

const STEPS: WizardStep[] = [
  {
    key: "organization",
    title: "Organisation & Hauptshop",
    description: "Organisation und Hauptshop wurden mit dem Owner-Claim angelegt.",
    icon: Building2,
  },
  {
    key: "storefront-domain",
    title: "Storefront-Domain",
    description:
      "Öffentliche Basis-URL der Storefront hinterlegen (für Webhook-URLs und E-Mail-Links).",
    icon: Globe,
  },
  {
    key: "payment-provider",
    title: "Payment Provider",
    description: "Mindestens einen Zahlungsanbieter verbinden und im Testmodus prüfen.",
    icon: CreditCard,
    action: { label: "Integrationen öffnen", to: "/app/einstellungen/integrationen" },
  },
  {
    key: "email-sender",
    title: "E-Mail Absender",
    description: "Versand-Provider verbinden und die Absenderdomain verifizieren.",
    icon: Mail,
    action: { label: "Integrationen öffnen", to: "/app/einstellungen/integrationen" },
  },
  {
    key: "api-keys",
    title: "API-Zugänge",
    description: "Store-API-Keys für Storefront und Integrationen erzeugen.",
    icon: KeyRound,
    action: { label: "API-Keys verwalten", to: "/app/entwickler/api-keys" },
  },
  {
    key: "docs-check",
    title: "Go-live Unterlagen",
    description: "Impressum, Datenschutz und Betreiberangaben der Storefront pflegen.",
    icon: BookOpen,
    action: { label: "Dokumentation", to: "/dokumentation" },
  },
];

function SetupWizardPage() {
  const router = useRouter();
  const { orgId } = useWorkspaceStore();
  const statusFn = useServerFn(getInstallationStatus);
  const workspaceFn = useServerFn(getWorkspace);
  const saveStepFn = useServerFn(saveSetupStep);
  const setOriginFn = useServerFn(setStorefrontOriginFn);

  const { data: workspace } = useQuery({ queryKey: ["workspace"], queryFn: () => workspaceFn() });
  const activeOrg =
    workspace?.organizations.find((o) => o.id === orgId) ?? workspace?.organizations[0];

  const { data: status } = useQuery({
    queryKey: ["installation-status"],
    queryFn: () => statusFn(),
  });
  const setupState =
    status && status.installed ? (status.setupProgress) : {};

  const [origin, setOrigin] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(step: string, done: boolean) {
    if (!activeOrg) return;
    setSaving(step);
    try {
      await saveStepFn({ data: { organizationId: activeOrg.id, step, done } });
      router.invalidate();
    } finally {
      setSaving(null);
    }
  }

  async function saveOrigin() {
    if (!activeOrg || !origin.trim()) return;
    setSaving("storefront-domain");
    try {
      await setOriginFn({ data: { organizationId: activeOrg.id, origin: origin.trim() } });
      await saveStepFn({ data: { organizationId: activeOrg.id, step: "storefront-domain", done: true } });
      router.invalidate();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <EyisLogo variant="full" width={220} className="max-w-[70vw]" />
      <PageHeader
        title="Einrichtung"
        description="Geführte Einrichtung dieser Instanz. Jeder Schritt kann in beliebiger Reihenfolge abgeschlossen werden."
      />

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <ServerCog className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Dedicated-Installation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {runtime?.deploymentMode === "dedicated"
                ? runtime.publishableKey
                  ? "Diese Instanz betreibt ihren eigenen Shop. Die Storefront bezieht Key und API automatisch über dieselbe Domain — keine manuelle Konfiguration."
                  : "Dedicated-Modus aktiv. Organisation und Hauptshop sind noch nicht als Installation registriert."
                : "Diese Instanz läuft im Shared-Modus. Für den Dedicated-Betrieb muss COMMERCE_DEPLOYMENT_MODE=dedicated gesetzt sein."}
            </p>
            {runtime?.publishableKey && (
              <dl className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <div>
                  <dt className="inline font-medium text-foreground">Store API: </dt>
                  <dd className="inline tabular-nums">{runtime.apiBaseUrl}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-foreground">Publishable Key: </dt>
                  <dd className="inline break-all tabular-nums">{runtime.publishableKey}</dd>
                </div>
              </dl>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pl-12">
          {runtime?.deploymentMode === "dedicated" && !runtime.publishableKey && (
            <Button size="sm" disabled={saving === "adopt" || !activeOrg} onClick={adopt}>
              Installation übernehmen
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <Link to="/store">
              Storefront öffnen
              <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
        {adoptError && <p className="pl-12 text-sm text-destructive">{adoptError}</p>}
      </section>

      <div className="flex flex-col gap-3">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const done = setupState[step.key] === "done";
          return (
            <div
              key={step.key}
              className={cn(
                "flex flex-col gap-3 rounded-xl border bg-card p-4",
                done && "border-success/40",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">{index + 1}.</span>
                    <h2 className="text-sm font-semibold">{step.title}</h2>
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>

              {step.key === "storefront-domain" && (
                <div className="flex gap-2 pl-12">
                  <Input
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="https://shop.example.com"
                    className="max-w-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving === "storefront-domain" || !origin.trim()}
                    onClick={saveOrigin}
                  >
                    Speichern
                  </Button>
                </div>
              )}

              <div className="flex gap-2 pl-12">
                {step.action && (
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={step.action.to}>
                      {step.action.label}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                )}
                {step.key !== "organization" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={saving === step.key}
                    onClick={() => toggle(step.key, !done)}
                  >
                    {done ? "Zurücksetzen" : "Als erledigt markieren"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
