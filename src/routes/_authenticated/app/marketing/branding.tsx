import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listStorefrontContent,
  saveStorefrontBranding,
} from "@/lib/commerce/storefront/content.functions";
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
import { ErrorState, ListSkeleton, PermissionState } from "@/eyis/data/States";
import { PresetPicker } from "@/eyis/brand/PresetPicker";
import { ColorField } from "@/eyis/brand/ColorField";
import { LogoUploadField } from "@/eyis/brand/LogoUploadField";
import { BrandingPreview } from "@/eyis/brand/BrandingPreview";
import { brandingPresets, fontPairs, type BrandingPreset } from "@/eyis/brand/storefront-presets";

export const Route = createFileRoute("/_authenticated/app/marketing/branding")({
  head: () => ({
    meta: [
      { title: "Storefront-Branding – EYIS" },
      {
        name: "description",
        content: "Logo, Farben, Schriften und Vorlage deiner Storefront festlegen.",
      },
      { property: "og:title", content: "Storefront-Branding – EYIS" },
      { property: "og:description", content: "Logo, Farben und Schriften der Storefront." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BrandingPage,
});

const emptyForm = {
  shop_name: "",
  claim: "",
  logo_url: "",
  favicon_url: "",
  color_background: "",
  color_foreground: "",
  color_surface: "",
  color_border: "",
  color_accent: "",
  color_accent_foreground: "",
  color_deep: "",
  font_display: "",
  font_body: "",
};

type Form = typeof emptyForm;

function BrandingPage() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, can } = useActiveWorkspace();
  const canManage = can("settings.manage");

  const fetchContent = useServerFn(listStorefrontContent);
  const runSave = useServerFn(saveStorefrontBranding);

  const query = useQuery({
    queryKey: ["storefront-content", organizationId, shopId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchContent({ data: { organizationId, shopId } }),
  });

  const [form, setForm] = useState<Form>({ ...emptyForm });
  const [presetId, setPresetId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded || !query.data) return;
    const branding = query.data.branding;
    if (branding) {
      setForm({
        shop_name: branding.shop_name ?? "",
        claim: branding.claim ?? "",
        logo_url: branding.logo_url ?? "",
        favicon_url: branding.favicon_url ?? "",
        color_background: branding.color_background ?? "",
        color_foreground: branding.color_foreground ?? "",
        color_surface: branding.color_surface ?? "",
        color_border: branding.color_border ?? "",
        color_accent: branding.color_accent ?? "",
        color_accent_foreground: branding.color_accent_foreground ?? "",
        color_deep: branding.color_deep ?? "",
        font_display: branding.font_display ?? "",
        font_body: branding.font_body ?? "",
      });
    }
    setLoaded(true);
  }, [query.data, loaded]);

  const applyPreset = (preset: BrandingPreset) => {
    const pair = fontPairs.find((f) => f.id === preset.fontPairId);
    setPresetId(preset.id);
    setForm((current) => ({
      ...current,
      color_background: preset.colors.colorBackground,
      color_foreground: preset.colors.colorForeground,
      color_surface: preset.colors.colorSurface,
      color_border: preset.colors.colorBorder,
      color_accent: preset.colors.colorAccent,
      color_accent_foreground: preset.colors.colorAccentForeground,
      color_deep: preset.colors.colorDeep,
      font_display: pair?.display ?? current.font_display,
      font_body: pair?.body ?? current.font_body,
    }));
  };

  const activeFontPair =
    fontPairs.find((f) => f.display === form.font_display && f.body === form.font_body)?.id ??
    "custom";

  const saveMutation = useMutation({
    mutationFn: () => runSave({ data: { organizationId, shopId, ...form } }),
    onSuccess: () => {
      toast.success("Branding gespeichert.");
      void queryClient.invalidateQueries({ queryKey: ["storefront-content"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Storefront-Branding" />
        <ErrorState
          description={(query.error as Error).message}
          action={<Button onClick={() => query.refetch()}>Erneut laden</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storefront-Branding"
        description="Vorlage wählen, Logo hochladen, Farben und Schriften festlegen. Die Storefront liest diese Werte über die Store API."
      />

      {!canManage ? <PermissionState what="das Ändern des Storefront-Brandings" /> : null}

      {query.isPending ? (
        <ListSkeleton rows={3} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 space-y-6">
            <Panel title="Vorlage" description="Fertige Kombination aus Farben und Schriften.">
              <PresetPicker
                activeId={presetId ?? brandingPresets.find((p) => p.colors.colorAccent === form.color_accent)?.id ?? null}
                onSelect={applyPreset}
              />
            </Panel>

            <Panel title="Marke" description="Name, Claim, Logo und Favicon.">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shop-name">Shopname</Label>
                  <Input
                    id="shop-name"
                    value={form.shop_name}
                    onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="claim">Claim</Label>
                  <Input
                    id="claim"
                    value={form.claim}
                    onChange={(e) => setForm({ ...form, claim: e.target.value })}
                    disabled={!canManage}
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <LogoUploadField
                  id="logo"
                  label="Logo"
                  description="PNG, JPG, WebP oder AVIF."
                  value={form.logo_url}
                  onChange={(value) => setForm({ ...form, logo_url: value })}
                  organizationId={organizationId}
                  shopId={shopId}
                  canUpload={canManage}
                />
                <LogoUploadField
                  id="favicon"
                  label="Favicon"
                  description="Quadratisch, mindestens 64 × 64 Pixel."
                  value={form.favicon_url}
                  onChange={(value) => setForm({ ...form, favicon_url: value })}
                  organizationId={organizationId}
                  shopId={shopId}
                  canUpload={canManage}
                />
              </div>
            </Panel>

            <Panel title="Farben" description="Farbwähler oder Hex-Wert.">
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField
                  id="color-background"
                  label="Hintergrund"
                  hint="#FFFFFF"
                  value={form.color_background}
                  onChange={(v) => setForm({ ...form, color_background: v })}
                />
                <ColorField
                  id="color-foreground"
                  label="Schrift"
                  hint="#1A1A1A"
                  value={form.color_foreground}
                  onChange={(v) => setForm({ ...form, color_foreground: v })}
                />
                <ColorField
                  id="color-surface"
                  label="Flächen"
                  hint="#F5F3EF"
                  value={form.color_surface}
                  onChange={(v) => setForm({ ...form, color_surface: v })}
                />
                <ColorField
                  id="color-border"
                  label="Linien"
                  hint="#E2DED7"
                  value={form.color_border}
                  onChange={(v) => setForm({ ...form, color_border: v })}
                />
                <ColorField
                  id="color-accent"
                  label="Akzent"
                  hint="#B07A3C"
                  value={form.color_accent}
                  onChange={(v) => setForm({ ...form, color_accent: v })}
                />
                <ColorField
                  id="color-accent-foreground"
                  label="Schrift auf Akzent"
                  hint="#FFFFFF"
                  value={form.color_accent_foreground}
                  onChange={(v) => setForm({ ...form, color_accent_foreground: v })}
                />
                <ColorField
                  id="color-deep"
                  label="Fußzeile"
                  hint="#243027"
                  value={form.color_deep}
                  onChange={(v) => setForm({ ...form, color_deep: v })}
                />
              </div>
            </Panel>

            <Panel title="Schriften" description="Schriftpaar für Überschriften und Fließtext.">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="font-pair">Schriftpaar</Label>
                  <Select
                    value={activeFontPair}
                    onValueChange={(value) => {
                      const pair = fontPairs.find((f) => f.id === value);
                      if (!pair) return;
                      setForm({ ...form, font_display: pair.display, font_body: pair.body });
                    }}
                    disabled={!canManage}
                  >
                    <SelectTrigger id="font-pair">
                      <SelectValue placeholder="Schriftpaar wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {fontPairs.map((pair) => (
                        <SelectItem key={pair.id} value={pair.id}>
                          {pair.label}
                        </SelectItem>
                      ))}
                      {activeFontPair === "custom" ? (
                        <SelectItem value="custom">Eigene Angabe</SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="font-display">Überschriften</Label>
                  <Input
                    id="font-display"
                    value={form.font_display}
                    onChange={(e) => setForm({ ...form, font_display: e.target.value })}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="font-body">Fließtext</Label>
                  <Input
                    id="font-body"
                    value={form.font_body}
                    onChange={(e) => setForm({ ...form, font_body: e.target.value })}
                    disabled={!canManage}
                  />
                </div>
              </div>
            </Panel>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!canManage || saveMutation.isPending}
              >
                Branding speichern
              </Button>
              <Button variant="ghost" onClick={() => setForm({ ...emptyForm })} disabled={!canManage}>
                Zurücksetzen
              </Button>
            </div>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <Panel title="Vorschau" description="So wirkt die Auswahl im Shop.">
              <BrandingPreview
                shopName={form.shop_name}
                claim={form.claim}
                logoUrl={form.logo_url}
                colors={{
                  colorBackground: form.color_background,
                  colorForeground: form.color_foreground,
                  colorSurface: form.color_surface,
                  colorBorder: form.color_border,
                  colorAccent: form.color_accent,
                  colorAccentForeground: form.color_accent_foreground,
                  colorDeep: form.color_deep,
                }}
                fontDisplay={form.font_display}
                fontBody={form.font_body}
              />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
