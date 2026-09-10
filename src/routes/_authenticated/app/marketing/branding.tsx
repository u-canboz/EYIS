import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { Panel } from "@/eyis/shell/DetailLayout";
import { ListSkeleton } from "@/eyis/data/States";
import { PresetPicker } from "@/eyis/brand/PresetPicker";
import { ColorField } from "@/eyis/brand/ColorField";
import { LogoUploadField } from "@/eyis/brand/LogoUploadField";
import { BrandingPreview } from "@/eyis/brand/BrandingPreview";
import {
  brandingPresets,
  fontPairs,
  isHexColor,
  type BrandingPreset,
} from "@/eyis/brand/storefront-presets";

export const Route = createFileRoute("/_authenticated/app/marketing/branding")({
  head: () => ({
    meta: [
      { title: "Storefront-Branding – EYIS" },
      {
        name: "description",
        content: "Vorlage wählen, Logo hochladen, Farben und Schriften der Storefront festlegen.",
      },
      { property: "og:title", content: "Storefront-Branding – EYIS" },
      {
        property: "og:description",
        content: "Auftritt des Shops ohne Code ändern: Vorlagen, Logo, Farben, Schriften.",
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

const CUSTOM_FONT = "__custom__";

function StorefrontBrandingPage() {
  const { organizationId, shopId, can } = useActiveWorkspace();
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

  const activePresetId = useMemo(() => {
    const match = brandingPresets.find((preset) =>
      (Object.keys(preset.colors) as (keyof typeof preset.colors)[]).every(
        (key) => draft[key].trim().toUpperCase() === preset.colors[key].toUpperCase(),
      ),
    );
    return match?.id ?? null;
  }, [draft]);

  const activeFontId = useMemo(() => {
    if (draft.fontDisplay === "" && draft.fontBody === "") return "";
    const pair = fontPairs.find(
      (f) => f.display === draft.fontDisplay && f.body === draft.fontBody,
    );
    return pair?.id ?? CUSTOM_FONT;
  }, [draft.fontDisplay, draft.fontBody]);

  const applyPreset = (preset: BrandingPreset) => {
    const pair = fontPairs.find((f) => f.id === preset.fontPairId);
    setDraft((d) => ({
      ...d,
      ...preset.colors,
      fontDisplay: pair?.display ?? d.fontDisplay,
      fontBody: pair?.body ?? d.fontBody,
    }));
    toast.success(`Vorlage „${preset.label}“ übernommen. Noch nicht gespeichert.`);
  };

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
    (field) => String(draft[field.key]).trim() !== "" && !isHexColor(String(draft[field.key])),
  );

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Storefront-Branding"
        description="Vorlage wählen oder eigene Farben, Schriften und Logos festlegen. Änderungen gelten für alle Seiten des Shops."
      />

      {branding.isLoading ? (
        <ListSkeleton />
      ) : (
        <>
          <Panel
            title="Vorlage"
            description="Ein Klick setzt alle Farben und beide Schriften. Name, Claim und Logo bleiben unverändert."
          >
            <PresetPicker activeId={activePresetId} onSelect={applyPreset} />
          </Panel>

          <Panel title="Vorschau" description="So wirkt die aktuelle Auswahl im Shop.">
            <BrandingPreview
              shopName={draft.shopName}
              claim={draft.claim}
              logoUrl={draft.logoUrl}
              colors={{
                colorBackground: draft.colorBackground,
                colorForeground: draft.colorForeground,
                colorSurface: draft.colorSurface,
                colorBorder: draft.colorBorder,
                colorAccent: draft.colorAccent,
                colorAccentForeground: draft.colorAccentForeground,
                colorDeep: draft.colorDeep,
              }}
              fontDisplay={draft.fontDisplay}
              fontBody={draft.fontBody}
            />
          </Panel>

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
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <LogoUploadField
                id="logoUrl"
                label="Logo"
                description="PNG, JPG, WEBP oder AVIF bis 2 MB hierher ziehen. SVG bitte als Adresse eintragen."
                value={draft.logoUrl}
                onChange={(value) => set("logoUrl", value)}
                organizationId={organizationId}
                shopId={shopId}
                canUpload={can("media.upload")}
              />
              <LogoUploadField
                id="faviconUrl"
                label="Symbol im Browser-Tab"
                description="Quadratisches Bild, mindestens 64 × 64 Pixel."
                value={draft.faviconUrl}
                onChange={(value) => set("faviconUrl", value)}
                organizationId={organizationId}
                shopId={shopId}
                canUpload={can("media.upload")}
              />
            </div>
          </Panel>

          <Panel
            title="Farben"
            description="Farbe anklicken oder Hex-Wert eintragen. Leere Felder behalten die Vorgabe des Themes."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {colorFields.map((field) => (
                <ColorField
                  key={field.key}
                  id={field.key}
                  label={field.label}
                  hint={field.hint}
                  value={String(draft[field.key])}
                  onChange={(value) => set(field.key, value)}
                />
              ))}
            </div>
          </Panel>

          <Panel
            title="Schriften"
            description="Fertiges Schriftpaar wählen oder eigene Schriftfamilien eintragen."
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fontPair">Schriftpaar</Label>
                <Select
                  value={activeFontId === "" ? undefined : activeFontId}
                  onValueChange={(value) => {
                    if (value === CUSTOM_FONT) return;
                    const pair = fontPairs.find((f) => f.id === value);
                    if (!pair) return;
                    setDraft((d) => ({ ...d, fontDisplay: pair.display, fontBody: pair.body }));
                  }}
                >
                  <SelectTrigger id="fontPair" className="sm:max-w-md">
                    <SelectValue placeholder="Schriftpaar wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {fontPairs.map((pair) => (
                      <SelectItem key={pair.id} value={pair.id}>
                        {pair.label}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_FONT}>Eigene Schrift</SelectItem>
                  </SelectContent>
                </Select>
                {activeFontId === CUSTOM_FONT ? (
                  <p className="text-xs text-muted-foreground">
                    Es sind eigene Schriftfamilien hinterlegt.
                  </p>
                ) : null}
              </div>

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
            </div>
          </Panel>

          <div className="flex flex-wrap items-center gap-3">
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
