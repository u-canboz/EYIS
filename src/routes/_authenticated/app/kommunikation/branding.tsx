import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import {
  getBrandingFn,
  previewTemplateFn,
  saveBrandingFn,
} from "@/lib/commerce/communications/communication.functions";
import type { BrandingSettings } from "@/lib/commerce/communications/studio.server";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StickyActionBar } from "@/components/shell/PageHeader";
import { DetailLayout, Panel } from "@/components/shell/DetailLayout";

export const Route = createFileRoute("/_authenticated/app/kommunikation/branding")({
  head: () => ({
    meta: [
      { title: "E-Mail-Branding – Commerce OS" },
      {
        name: "description",
        content: "Logo, Farben, Schrift und Footer für alle transaktionalen E-Mails dieses Shops.",
      },
      { property: "og:title", content: "E-Mail-Branding – Commerce OS" },
      { property: "og:description", content: "Einheitliches Erscheinungsbild für alle E-Mails." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BrandingPage,
});

const COLOR_FIELDS: { key: keyof BrandingSettings; label: string }[] = [
  { key: "primaryColor", label: "Akzentfarbe" },
  { key: "backgroundColor", label: "Seitenhintergrund" },
  { key: "contentBackgroundColor", label: "Inhaltsfläche" },
  { key: "textColor", label: "Textfarbe" },
  { key: "mutedTextColor", label: "Sekundärtext" },
];

function BrandingPage() {
  const { organizationId, shopId } = useActiveWorkspace();
  const fetchBranding = useServerFn(getBrandingFn);
  const save = useServerFn(saveBrandingFn);
  const preview = useServerFn(previewTemplateFn);

  const branding = useQuery({
    queryKey: ["communication-branding", organizationId, shopId],
    enabled: !!organizationId && !!shopId,
    queryFn: () => fetchBranding({ data: { organizationId, shopId } }),
  });

  const [settings, setSettings] = useState<BrandingSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (branding.data) setSettings(branding.data);
  }, [branding.data]);

  const previewQuery = useQuery({
    queryKey: ["communication-branding-preview", organizationId, shopId, branding.dataUpdatedAt],
    enabled: !!organizationId && !!shopId,
    queryFn: () => preview({ data: { organizationId, shopId, templateKey: "order.confirmation" } }),
  });

  if (!settings) {
    return (
      <div className="min-w-0 space-y-5">
        <PageHeader title="Branding" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  function set<K extends keyof BrandingSettings>(key: K, value: BrandingSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function doSave() {
    setBusy(true);
    try {
      await save({ data: { organizationId, shopId, settings: settings! } });
      toast.success("Branding gespeichert.");
      await branding.refetch();
      await previewQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 space-y-5 pb-20 sm:pb-0">
      <PageHeader
        eyebrow={
          <Link
            to="/app/kommunikation"
            className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
            Kommunikation
          </Link>
        }
        title="Branding"
        description="Gilt für alle E-Mails dieses Shops – Vorlagen erben diese Gestaltung automatisch."
        actions={
          <Button className="hidden h-11 sm:inline-flex" disabled={busy} onClick={doSave}>
            Speichern
          </Button>
        }
      />

      <DetailLayout
        main={
          <Panel title="Gestaltung" bodyClassName="space-y-4">
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              {COLOR_FIELDS.map((f) => (
                <div key={f.key} className="min-w-0 space-y-2">
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      aria-label={f.label}
                      className="h-11 w-12 shrink-0 cursor-pointer rounded border border-border bg-transparent"
                      value={String(settings[f.key] ?? "#000000")}
                      onChange={(e) => set(f.key, e.target.value as never)}
                    />
                    <Input
                      id={f.key}
                      className="h-11"
                      value={String(settings[f.key] ?? "")}
                      onChange={(e) => set(f.key, e.target.value as never)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="fontFamily">Schriftfamilie</Label>
                <Input
                  id="fontFamily"
                  className="h-11"
                  value={settings.fontFamily}
                  onChange={(e) => set("fontFamily", e.target.value)}
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="borderRadius">Eckenradius (px)</Label>
                <Input
                  id="borderRadius"
                  className="h-11"
                  type="number"
                  min={0}
                  max={32}
                  value={settings.borderRadius}
                  onChange={(e) => set("borderRadius", Number(e.target.value))}
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="supportEmail">Support-E-Mail</Label>
                <Input
                  id="supportEmail"
                  className="h-11"
                  value={settings.supportEmail ?? ""}
                  onChange={(e) => set("supportEmail", e.target.value || null)}
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="websiteUrl">Website</Label>
                <Input
                  id="websiteUrl"
                  className="h-11"
                  value={settings.websiteUrl ?? ""}
                  onChange={(e) => set("websiteUrl", e.target.value || null)}
                />
              </div>
            </div>

            <div className="min-w-0 space-y-2">
              <Label htmlFor="footerText">Footer-Text</Label>
              <Textarea
                id="footerText"
                rows={3}
                value={settings.footerText}
                onChange={(e) => set("footerText", e.target.value)}
              />
              <p className="text-xs text-pretty text-muted-foreground">
                Rechtliche Pflichtangaben gehören hierher (z. B. Firma, Anschrift, Registernummer).
              </p>
            </div>
          </Panel>
        }
        aside={
          <Panel title="Vorschau (Bestellbestätigung)" bodyClassName="space-y-2">
            {previewQuery.isLoading ? (
              <Skeleton className="h-[600px] w-full" />
            ) : previewQuery.data ? (
              <div className="min-w-0 overflow-hidden rounded-lg border border-border">
                <iframe
                  title="Branding-Vorschau"
                  srcDoc={previewQuery.data.html}
                  className="h-[600px] w-full bg-white"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Vorschau verfügbar.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Die Vorschau aktualisiert sich nach dem Speichern.
            </p>
          </Panel>
        }
      />

      <StickyActionBar className="sm:hidden">
        <Button className="h-11 w-full" disabled={busy} onClick={doSave}>
          Speichern
        </Button>
      </StickyActionBar>
    </div>
  );
}
