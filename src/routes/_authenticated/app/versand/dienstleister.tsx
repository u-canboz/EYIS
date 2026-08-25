import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listCarrierConfigs,
  saveCarrierConfig,
  listPackagePresetsFn,
  savePackagePresetFn,
  deletePackagePresetFn,
} from "@/lib/commerce/shipping/carrier.functions";
import { CARRIER_CATALOG, carrierLabel } from "@/lib/commerce/shipping/carriers";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/versand/dienstleister")({
  head: () => ({
    meta: [
      { title: "Versanddienstleister – Commerce OS" },
      {
        name: "description",
        content:
          "Carrier aktivieren, Testmodus steuern und Verpackungs-Presets für die Kommissionierung pflegen.",
      },
      { property: "og:title", content: "Versanddienstleister – Commerce OS" },
      {
        property: "og:description",
        content: "DHL, DPD, GLS, UPS, Sendcloud und Test-Carrier konfigurieren.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CarrierSettings,
});

type ConfigDraft = {
  id: string | null;
  provider: string;
  displayName: string;
  status: "active" | "inactive" | "archived";
  testMode: boolean;
  priority: string;
  webhookSecretName: string;
};

type PresetDraft = {
  id: string | null;
  name: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  packagingType: string;
  isDefault: boolean;
};

const EMPTY_PRESET: PresetDraft = {
  id: null,
  name: "",
  weight: "",
  length: "",
  width: "",
  height: "",
  packagingType: "",
  isDefault: false,
};

function CarrierSettings() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, can } = useActiveWorkspace();
  const [config, setConfig] = useState<ConfigDraft | null>(null);
  const [preset, setPreset] = useState<PresetDraft | null>(null);

  const fetchConfigs = useServerFn(listCarrierConfigs);
  const saveConfig = useServerFn(saveCarrierConfig);
  const fetchPresets = useServerFn(listPackagePresetsFn);
  const savePreset = useServerFn(savePackagePresetFn);
  const deletePreset = useServerFn(deletePackagePresetFn);

  const configs = useQuery({
    queryKey: ["carrier-configs", organizationId, shopId],
    enabled: !!organizationId,
    queryFn: () => fetchConfigs({ data: { organizationId, shopId: shopId || null } }),
  });

  const presets = useQuery({
    queryKey: ["package-presets", organizationId, shopId],
    enabled: !!organizationId,
    queryFn: () => fetchPresets({ data: { organizationId, shopId: shopId || null } }),
  });

  const configMutation = useMutation({
    mutationFn: (d: ConfigDraft) =>
      saveConfig({
        data: {
          organizationId,
          shopId,
          id: d.id,
          provider: d.provider,
          displayName: d.displayName || carrierLabel(d.provider),
          status: d.status,
          testMode: d.testMode,
          priority: Number(d.priority) || 100,
          webhookSecretName: d.webhookSecretName || null,
        },
      }),
    onSuccess: () => {
      toast.success("Dienstleister gespeichert.");
      setConfig(null);
      queryClient.invalidateQueries({ queryKey: ["carrier-configs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const presetMutation = useMutation({
    mutationFn: (d: PresetDraft) =>
      savePreset({
        data: {
          organizationId,
          shopId: shopId || null,
          id: d.id,
          name: d.name,
          weightGrams: d.weight ? Number(d.weight) : null,
          lengthMm: d.length ? Number(d.length) : null,
          widthMm: d.width ? Number(d.width) : null,
          heightMm: d.height ? Number(d.height) : null,
          packagingType: d.packagingType || null,
          isDefault: d.isDefault,
        },
      }),
    onSuccess: () => {
      toast.success("Preset gespeichert.");
      setPreset(null);
      queryClient.invalidateQueries({ queryKey: ["package-presets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const presetDelete = useMutation({
    mutationFn: (id: string) => deletePreset({ data: { organizationId, id } }),
    onSuccess: () => {
      toast.success("Preset gelöscht.");
      queryClient.invalidateQueries({ queryKey: ["package-presets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const manage = can("shipping_settings.manage");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Versanddienstleister</h1>
        <p className="text-muted-foreground text-sm">
          Nur aktive Dienstleister können Labels erzeugen. Zugangsdaten liegen als Secrets, nie in
          der Datenbank.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Aktive Dienstleister</h2>
          {manage && (
            <Button
              onClick={() =>
                setConfig({
                  id: null,
                  provider: "mock",
                  displayName: "",
                  status: "active",
                  testMode: true,
                  priority: "100",
                  webhookSecretName: "",
                })
              }
            >
              Dienstleister hinzufügen
            </Button>
          )}
        </div>
        {configs.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !configs.data?.length ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            Noch kein Dienstleister aktiv. Ohne Dienstleister können keine Labels erzeugt werden.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Dienstleister</th>
                  <th className="p-3 font-medium">Anzeigename</th>
                  <th className="p-3 font-medium">Modus</th>
                  <th className="p-3 font-medium">Priorität</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {configs.data.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-3 font-medium">{carrierLabel(c.provider)}</td>
                    <td className="p-3">{c.displayName}</td>
                    <td className="p-3">{c.testMode ? "Test" : "Live"}</td>
                    <td className="p-3">{c.priority}</td>
                    <td className="p-3">
                      <Badge variant={c.status === "active" ? "default" : "secondary"}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {manage && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setConfig({
                              id: c.id,
                              provider: c.provider,
                              displayName: c.displayName,
                              status: c.status,
                              testMode: c.testMode,
                              priority: String(c.priority),
                              webhookSecretName: "",
                            })
                          }
                        >
                          Bearbeiten
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Verpackungs-Presets</h2>
          {manage && (
            <Button variant="outline" onClick={() => setPreset({ ...EMPTY_PRESET })}>
              Preset anlegen
            </Button>
          )}
        </div>
        {presets.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !presets.data?.length ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            Noch keine Presets. Presets beschleunigen das Verpacken.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Gewicht</th>
                  <th className="p-3 font-medium">Maße (mm)</th>
                  <th className="p-3 font-medium">Typ</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {presets.data.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3 font-medium">
                      {p.name} {p.isDefault && <Badge variant="secondary">Standard</Badge>}
                    </td>
                    <td className="p-3">{p.weightGrams ? `${p.weightGrams} g` : "—"}</td>
                    <td className="p-3">
                      {[p.lengthMm, p.widthMm, p.heightMm].every((v) => v === null)
                        ? "—"
                        : `${p.lengthMm ?? "?"} × ${p.widthMm ?? "?"} × ${p.heightMm ?? "?"}`}
                    </td>
                    <td className="p-3">{p.packagingType ?? "—"}</td>
                    <td className="p-3 text-right">
                      {manage && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setPreset({
                                id: p.id,
                                name: p.name,
                                weight: p.weightGrams === null ? "" : String(p.weightGrams),
                                length: p.lengthMm === null ? "" : String(p.lengthMm),
                                width: p.widthMm === null ? "" : String(p.widthMm),
                                height: p.heightMm === null ? "" : String(p.heightMm),
                                packagingType: p.packagingType ?? "",
                                isDefault: p.isDefault,
                              })
                            }
                          >
                            Bearbeiten
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => presetDelete.mutate(p.id)}
                          >
                            Löschen
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={!!config} onOpenChange={(open) => !open && setConfig(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {config?.id ? "Dienstleister bearbeiten" : "Dienstleister hinzufügen"}
            </DialogTitle>
          </DialogHeader>
          {config && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Dienstleister</Label>
                <Select
                  value={config.provider}
                  onValueChange={(v) => setConfig({ ...config, provider: v })}
                  disabled={!!config.id}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRIER_CATALOG.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.displayName}
                        {c.implemented ? "" : " — noch ohne Zugangsdaten"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Anzeigename</Label>
                <Input
                  value={config.displayName}
                  placeholder={carrierLabel(config.provider)}
                  onChange={(e) => setConfig({ ...config, displayName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Priorität</Label>
                  <Input
                    value={config.priority}
                    onChange={(e) => setConfig({ ...config, priority: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={config.status}
                    onValueChange={(v) =>
                      setConfig({ ...config, status: v as ConfigDraft["status"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Aktiv</SelectItem>
                      <SelectItem value="inactive">Inaktiv</SelectItem>
                      <SelectItem value="archived">Archiviert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Webhook-Secret (Name des Secrets)</Label>
                <Input
                  value={config.webhookSecretName}
                  placeholder="z. B. DHL_WEBHOOK_SECRET"
                  onChange={(e) => setConfig({ ...config, webhookSecretName: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Testmodus</p>
                  <p className="text-muted-foreground text-xs">
                    Im Testmodus werden keine echten Labels gekauft.
                  </p>
                </div>
                <Switch
                  checked={config.testMode}
                  onCheckedChange={(v) => setConfig({ ...config, testMode: v })}
                />
              </div>
              <Button
                onClick={() => configMutation.mutate(config)}
                disabled={configMutation.isPending}
              >
                Speichern
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!preset} onOpenChange={(open) => !open && setPreset(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{preset?.id ? "Preset bearbeiten" : "Preset anlegen"}</DialogTitle>
          </DialogHeader>
          {preset && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={preset.name}
                  onChange={(e) => setPreset({ ...preset, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Gewicht (g)</Label>
                  <Input
                    value={preset.weight}
                    onChange={(e) => setPreset({ ...preset, weight: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Verpackungstyp</Label>
                  <Input
                    value={preset.packagingType}
                    onChange={(e) => setPreset({ ...preset, packagingType: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label>Länge</Label>
                  <Input
                    value={preset.length}
                    onChange={(e) => setPreset({ ...preset, length: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Breite</Label>
                  <Input
                    value={preset.width}
                    onChange={(e) => setPreset({ ...preset, width: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Höhe</Label>
                  <Input
                    value={preset.height}
                    onChange={(e) => setPreset({ ...preset, height: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <p className="text-sm font-medium">Als Standard verwenden</p>
                <Switch
                  checked={preset.isDefault}
                  onCheckedChange={(v) => setPreset({ ...preset, isDefault: v })}
                />
              </div>
              <Button
                onClick={() => presetMutation.mutate(preset)}
                disabled={presetMutation.isPending}
              >
                Speichern
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
