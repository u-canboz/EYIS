import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getStorefrontBrandingFn,
  saveStorefrontBrandingFn,
} from "@/lib/commerce/store/branding.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { Panel } from "@/eyis/shell/DetailLayout";
import { ListSkeleton } from "@/eyis/data/States";

export const Route = createFileRoute("/_authenticated/app/marketing/branding")({
  head: () => ({
    meta: [
      { title: "Storefront-Branding – EYIS" },
      {
        name: "description",
        content: "Shopname, Logo, Farben und Schriften der Storefront im Backoffice festlegen.",
      },
      { property: "og:title", content: "Storefront-Branding – EYIS" },
      {
        property: "og:description",
        content: "Auftritt des Shops ohne Code ändern: Name, Logo, Farben, Schriften.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StorefrontBrandingPage,
});

type Draft = {
  shopName: string;
  claim: string;
  logoUrl: string;
  faviconUrl: string;
  colorBackground: string;
  colorForeground: string;
  colorSurface: string;
  colorBorder: string;
  colorAccent: string;
  colorAccentForeground: string;
  colorDeep: string;
  fontDisplay: string;
  fontBody: string;
};

const emptyDraft: Draft = {
  shopName: "",
  claim: "",
  logoUrl: "",
  faviconUrl: "",
  colorBackground: "",
  colorForeground: "",
  colorSurface: "",
  colorBorder: "",
  colorAccent: "",
  colorAccentForeground: "",
  colorDeep: "",
  fontDisplay: "",
  fontBody: "",
};

const colorFields: { key: keyof Draft; label: string; hint: string }[] = [
  { key: "colorBackground", label: "Hintergrund", hint: "#FFFFFF" },
  { key: "colorForeground", label: "Textfarbe", hint: "#1A1A1A" },
  { key: "colorSurface", label: "Flächen", hint: "#F5F3EF" },
  { key: "colorBorder", label: "Linien", hint: "#E2DED7" },
  { key: "colorAccent", label: "Akzent", hint: "#B07A3C" },
  { key: "colorAccentForeground", label: "Schrift auf Akzent", hint: "#FFFFFF" },
  { key: "colorDeep", label: "Dunkelton", hint: "#243027" },
];

const isColor = (value: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());

function StorefrontBrandingPage() {
  const { organizationId, shopId } = useActiveWorkspace();
  const qc = useQueryClient();
  const enabled = !!organizationId && !!shopId;

  const load = useServerFn(getStorefrontBrandingFn);
  const save = useServerFn(saveStorefrontBrandingFn);

  const branding = useQuery({
    queryKey: ["storefront-branding", organizationId, shopId],
    enabled,
    queryFn: () => load({ data: { organizationId, shopId } }),
  });

  const [draft, setDraft] = useState<Draft>(emptyDraft);

  useEffect(() => {
    const data = branding.data;
    if (!data) return;
    setDraft({
      shopName: data.shopName ?? "",
      claim: data.claim ?? "",
      logoUrl: data.logoUrl ?? "",
      faviconUrl: data.faviconUrl ?? "",
      colorBackground: data.colorBackground ?? "",
      colorForeground: data.colorForeground ?? "",
      colorSurface: data.colorSurface ?? "",
      colorBorder: data.colorBorder ?? "",
      colorAccent: data.colorAccent ?? "",
      colorAccentForeground: data.colorAccentForeground ?? "",
      colorDeep: data.colorDeep ?? "",
      fontDisplay: data.fontDisplay ?? "",
      fontBody: data.fontBody ?? "",
    });
  }, [branding.data]);

  const set = (key: keyof Draft, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          organizationId,
          shopId,
          shopName: draft.shopName,
          claim: draft.claim,
          logoUrl: draft.logoUrl,
          faviconUrl: draft.faviconUrl,
          colorBackground: draft.colorBackground,
          colorForeground: draft.colorForeground,
          colorSurface: draft.colorSurface,
          colorBorder: draft.colorBorder,
          colorAccent: draft.colorAccent,
          colorAccentForeground: draft.colorAccentForeground,
          colorDeep: draft.colorDeep,
          fontDisplay: draft.fontDisplay,
          fontBody: draft.fontBody,
        },
      }),
    onSuccess: () => {
      toast.success("Branding gespeichert.");
      void qc.invalidateQueries({ queryKey: ["storefront-branding"] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Speichern nicht möglich."),
  });

  const invalidColor = colorFields.find(
    (field) => String(draft[field.key]).trim() !== "" && !isColor(String(draft[field.key])),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storefront-Branding"
        description="Shopname, Logo und Farben des Shops. Änderungen gelten für alle Seiten der Storefront."
      />

      {branding.isLoading ? (
        <ListSkeleton />
      ) : (
        <>
          <Panel title="Name und Logo">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shopName">Shopname</Label>
                <Input
                  id="shopName"
                  value={draft.shopName}
                  onChange={(e) => set("shopName", e.target.value)}
                  placeholder="Mein Shop"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="claim">Claim</Label>
                <Input
                  id="claim"
                  value={draft.claim}
                  onChange={(e) => set("claim", e.target.value)}
                  placeholder="Sorgfältig ausgewählt."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo (Adresse)</Label>
                <Input
                  id="logoUrl"
                  value={draft.logoUrl}
                  onChange={(e) => set("logoUrl", e.target.value)}
                  placeholder="https://…/logo.svg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="faviconUrl">Symbol im Browser-Tab</Label>
                <Input
                  id="faviconUrl"
                  value={draft.faviconUrl}
                  onChange={(e) => set("faviconUrl", e.target.value)}
                  placeholder="https://…/favicon.svg"
                />
              </div>
            </div>
            {draft.logoUrl.trim() !== "" ? (
              <div className="mt-4 flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3">
                <img
                  src={draft.logoUrl}
                  alt="Vorschau des hinterlegten Shop-Logos"
                  className="h-10 w-auto max-w-[220px] object-contain"
                  loading="lazy"
                />
                <span className="text-xs text-muted-foreground">Vorschau</span>
              </div>
            ) : null}
          </Panel>

          <Panel
            title="Farben"
            description="Farbwerte als Hex angeben, zum Beispiel #B07A3C. Leere Felder behalten die Vorgabe des Themes."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {colorFields.map((field) => {
                const value = String(draft[field.key]);
                const valid = value.trim() === "" || isColor(value);
                return (
                  <div className="space-y-2" key={field.key}>
                    <Label htmlFor={field.key}>{field.label}</Label>
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-9 w-9 shrink-0 rounded-md border border-border"
                        style={valid && value ? { backgroundColor: value } : undefined}
                      />
                      <Input
                        id={field.key}
                        value={value}
                        onChange={(e) => set(field.key, e.target.value)}
                        placeholder={field.hint}
                        aria-invalid={!valid}
                      />
                    </div>
                    {!valid ? (
                      <p className="text-xs text-destructive">
                        Bitte einen Hex-Wert wie {field.hint} eintragen.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel
            title="Schriften"
            description="Namen der Schriftfamilien. Die Schriftdateien werden im Kundenprojekt über das Seitenlayout geladen."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fontDisplay">Überschriften</Label>
                <Input
                  id="fontDisplay"
                  value={draft.fontDisplay}
                  onChange={(e) => set("fontDisplay", e.target.value)}
                  placeholder='Georgia, "Times New Roman", serif'
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fontBody">Fließtext</Label>
                <Input
                  id="fontBody"
                  value={draft.fontBody}
                  onChange={(e) => set("fontBody", e.target.value)}
                  placeholder="system-ui, -apple-system, Arial, sans-serif"
                />
              </div>
            </div>
          </Panel>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => mutation.mutate()}
              disabled={!enabled || mutation.isPending || !!invalidColor}
            >
              {mutation.isPending ? "Wird gespeichert…" : "Branding speichern"}
            </Button>
            {invalidColor ? (
              <span className="text-sm text-destructive">
                Bitte zuerst den Farbwert „{invalidColor.label}“ korrigieren.
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
