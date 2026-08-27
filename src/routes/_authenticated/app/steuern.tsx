import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  deleteTaxRate,
  getTaxConfiguration,
  previewTax,
  saveTaxClass,
  saveTaxRate,
  saveTaxSettings,
} from "@/lib/commerce/tax.functions";
import { TAX_REASON_LABELS } from "@/lib/commerce/tax";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney, parseMoneyToMinor } from "@/lib/commerce/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel, ScrollTabs } from "@/components/shell/DetailLayout";
import { TableScroll } from "@/components/data/TableScroll";
import { EmptyState, ListSkeleton, PermissionState } from "@/components/data/States";

export const Route = createFileRoute("/_authenticated/app/steuern")({
  head: () => ({
    meta: [
      { title: "Steuern – Commerce OS" },
      {
        name: "description",
        content:
          "Umsatzsteuer für Deutschland und die EU: Brutto- oder Nettoshop, Steuerklassen, Steuersätze, OSS, Reverse Charge und Steuerrechner.",
      },
      { property: "og:title", content: "Steuern – Commerce OS" },
      {
        property: "og:description",
        content: "Steuerklassen, Steuersätze und Steuerlogik je Shop verwalten.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TaxPage,
});

type Row = Record<string, string | number | boolean | null>;

type SettingsDraft = {
  calculationMode: "gross" | "net";
  homeCountryCode: string;
  defaultTaxClassId: string | null;
  pricesIncludeTax: boolean;
  displayPricesIncludingTax: boolean;
  shippingTaxStrategy: "fixed_class" | "proportional" | "highest_rate";
  shippingTaxClassId: string | null;
  b2bEnabled: boolean;
  euOssEnabled: boolean;
  smallBusinessExemptionEnabled: boolean;
  taxNumber: string;
  vatId: string;
};

const DEFAULT_SETTINGS: SettingsDraft = {
  calculationMode: "gross",
  homeCountryCode: "DE",
  defaultTaxClassId: null,
  pricesIncludeTax: true,
  displayPricesIncludingTax: true,
  shippingTaxStrategy: "fixed_class",
  shippingTaxClassId: null,
  b2bEnabled: false,
  euOssEnabled: false,
  smallBusinessExemptionEnabled: false,
  taxNumber: "",
  vatId: "",
};

function pct(bp: number) {
  return `${(bp / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
}

function TaxPage() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, shopCurrency, can } = useActiveWorkspace();
  const currency = shopCurrency ?? "EUR";
  const mayManage = can("tax.manage");

  const load = useServerFn(getTaxConfiguration);
  const saveSettingsFn = useServerFn(saveTaxSettings);
  const saveClassFn = useServerFn(saveTaxClass);
  const saveRateFn = useServerFn(saveTaxRate);
  const deleteRateFn = useServerFn(deleteTaxRate);
  const previewFn = useServerFn(previewTax);

  const config = useQuery({
    queryKey: ["tax-config", organizationId, shopId],
    enabled: !!organizationId && !!shopId,
    queryFn: () => load({ data: { organizationId: organizationId!, shopId: shopId! } }),
  });

  const classes = (config.data?.classes ?? []) as Row[];
  const rates = (config.data?.rates ?? []) as Row[];

  const [settings, setSettings] = useState<SettingsDraft>(DEFAULT_SETTINGS);
  useEffect(() => {
    const s = config.data?.settings as Row | null | undefined;
    if (!s) return;
    setSettings({
      calculationMode: s["calculation_mode"] as "gross" | "net",
      homeCountryCode: (s["home_country_code"] as string) ?? "DE",
      defaultTaxClassId: (s["default_tax_class_id"] as string) ?? null,
      pricesIncludeTax: !!s["prices_include_tax"],
      displayPricesIncludingTax: !!s["display_prices_including_tax"],
      shippingTaxStrategy: s["shipping_tax_strategy"] as SettingsDraft["shippingTaxStrategy"],
      shippingTaxClassId: (s["shipping_tax_class_id"] as string) ?? null,
      b2bEnabled: !!s["b2b_enabled"],
      euOssEnabled: !!s["eu_oss_enabled"],
      smallBusinessExemptionEnabled: !!s["small_business_exemption_enabled"],
      taxNumber: (s["tax_number"] as string) ?? "",
      vatId: (s["vat_id"] as string) ?? "",
    });
  }, [config.data]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["tax-config", organizationId, shopId] });

  const saveSettings = useMutation({
    mutationFn: () =>
      saveSettingsFn({
        data: {
          organizationId: organizationId!,
          shopId: shopId!,
          ...settings,
          taxNumber: settings.taxNumber || null,
          vatId: settings.vatId || null,
        },
      }),
    onSuccess: () => {
      toast.success("Steuereinstellungen gespeichert.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- classes ----
  const [newClass, setNewClass] = useState({ name: "", code: "" });
  const addClass = useMutation({
    mutationFn: () =>
      saveClassFn({
        data: {
          organizationId: organizationId!,
          shopId: null,
          name: newClass.name,
          code: newClass.code || newClass.name,
          description: null,
        },
      }),
    onSuccess: () => {
      setNewClass({ name: "", code: "" });
      toast.success("Steuerklasse angelegt.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- rates ----
  const [rateDraft, setRateDraft] = useState({
    taxClassId: "",
    countryCode: "DE",
    percent: "19",
    customerType: "any" as const,
  });
  const addRate = useMutation({
    mutationFn: () =>
      saveRateFn({
        data: {
          organizationId: organizationId!,
          shopId: null,
          taxClassId: rateDraft.taxClassId,
          countryCode: rateDraft.countryCode,
          regionCode: null,
          rateBasisPoints: Math.round(Number(rateDraft.percent.replace(",", ".")) * 100),
          customerType: rateDraft.customerType,
          validFrom: new Date().toISOString(),
          validUntil: null,
          status: "active",
        },
      }),
    onSuccess: () => {
      toast.success("Steuersatz gespeichert.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeRate = useMutation({
    mutationFn: (id: string) => deleteRateFn({ data: { organizationId: organizationId!, id } }),
    onSuccess: () => {
      toast.success("Steuersatz entfernt.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- preview ----
  const [preview, setPreview] = useState({
    country: "DE",
    customerType: "consumer" as "consumer" | "business",
    vatIdValid: false,
    amount: "49,90",
    quantity: "1",
    shipping: "4,90",
    taxClassId: "",
  });
  const runPreview = useMutation({
    mutationFn: () =>
      previewFn({
        data: {
          organizationId: organizationId!,
          shopId: shopId!,
          destinationCountryCode: preview.country,
          customerType: preview.customerType,
          vatIdValid: preview.vatIdValid,
          shippingMinor: parseMoneyToMinor(preview.shipping, currency) ?? 0,
          lines: [
            {
              taxClassId: preview.taxClassId || null,
              amountMinor: parseMoneyToMinor(preview.amount, currency) ?? 0,
              quantity: Number(preview.quantity) || 1,
            },
          ],
        },
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  const classById = useMemo(() => new Map(classes.map((c) => [c["id"] as string, c])), [classes]);
  const result = runPreview.data?.result;

  if (!organizationId || !shopId) {
    return <PermissionState what="Steuereinstellungen ohne ausgewählten Shop" />;
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Steuern"
        description="Umsatzsteuerlogik für Deutschland und die EU. Alle Berechnungen laufen serverseitig in der Steuer-Engine und werden bei jeder Bestellung unveränderlich protokolliert."
      />

      {config.isLoading ? (
        <ListSkeleton />
      ) : (
        <Tabs defaultValue="settings">
          <ScrollTabs>
            <TabsList>
              <TabsTrigger value="settings">Einstellungen</TabsTrigger>
              <TabsTrigger value="classes">Steuerklassen</TabsTrigger>
              <TabsTrigger value="rates">Steuersätze</TabsTrigger>
              <TabsTrigger value="preview">Steuerrechner</TabsTrigger>
            </TabsList>
          </ScrollTabs>

          {/* ---------------- Settings ---------------- */}
          <TabsContent value="settings" className="space-y-5 pt-4">
            <Panel>
              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label>Preismodus</Label>
                  <Select
                    value={settings.calculationMode}
                    onValueChange={(v) =>
                      setSettings((s) => ({
                        ...s,
                        calculationMode: v as "gross" | "net",
                        pricesIncludeTax: v === "gross",
                      }))
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gross">
                        Bruttoshop — Preise enthalten Umsatzsteuer
                      </SelectItem>
                      <SelectItem value="net">Nettoshop — Steuer wird aufgeschlagen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Sitzland</Label>
                  <Input
                    className="h-11"
                    value={settings.homeCountryCode}
                    maxLength={2}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, homeCountryCode: e.target.value.toUpperCase() }))
                    }
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Standard-Steuerklasse</Label>
                  <Select
                    value={settings.defaultTaxClassId ?? "none"}
                    onValueChange={(v) =>
                      setSettings((s) => ({ ...s, defaultTaxClassId: v === "none" ? null : v }))
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Automatisch (Standard)</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c["id"] as string} value={c["id"] as string}>
                          {c["name"] as string}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Versandbesteuerung</Label>
                  <Select
                    value={settings.shippingTaxStrategy}
                    onValueChange={(v) =>
                      setSettings((s) => ({
                        ...s,
                        shippingTaxStrategy: v as SettingsDraft["shippingTaxStrategy"],
                      }))
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed_class">Feste Steuerklasse für Versand</SelectItem>
                      <SelectItem value="proportional">Anteilig nach Warenkorb</SelectItem>
                      <SelectItem value="highest_rate">Höchster Steuersatz im Warenkorb</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Steuernummer</Label>
                  <Input
                    className="h-11"
                    value={settings.taxNumber}
                    onChange={(e) => setSettings((s) => ({ ...s, taxNumber: e.target.value }))}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>USt-IdNr. des Shops</Label>
                  <Input
                    className="h-11"
                    value={settings.vatId}
                    onChange={(e) => setSettings((s) => ({ ...s, vatId: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mt-4 min-w-0 space-y-3 rounded-lg border border-border p-4">
                {[
                  {
                    key: "displayPricesIncludingTax" as const,
                    label: "Preise inklusive Steuer anzeigen",
                  },
                  { key: "b2bEnabled" as const, label: "B2B-Checkout mit USt-IdNr. erlauben" },
                  { key: "euOssEnabled" as const, label: "EU-OSS aktiv (Bestimmungslandprinzip)" },
                  {
                    key: "smallBusinessExemptionEnabled" as const,
                    label: "Kleinunternehmerregelung § 19 UStG",
                  },
                ].map((row) => (
                  <div key={row.key} className="flex min-w-0 items-center justify-between gap-4">
                    <span className="min-w-0 text-sm">{row.label}</span>
                    <Switch
                      checked={settings[row.key]}
                      onCheckedChange={(v) => setSettings((s) => ({ ...s, [row.key]: v }))}
                      disabled={!mayManage}
                    />
                  </div>
                ))}
              </div>

              <Button
                className="mt-4 h-11"
                onClick={() => saveSettings.mutate()}
                disabled={!mayManage || saveSettings.isPending}
              >
                Einstellungen speichern
              </Button>
            </Panel>
          </TabsContent>

          {/* ---------------- Classes ---------------- */}
          <TabsContent value="classes" className="space-y-4 pt-4">
            <Panel bodyClassName="p-0">
              {classes.length === 0 ? (
                <EmptyState title="Keine Steuerklassen" description="Lege unten eine erste Steuerklasse an." className="border-0" />
              ) : (
                <div className="min-w-0 divide-y divide-border">
                  {classes.map((c) => (
                    <div
                      key={c["id"] as string}
                      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c["name"] as string}</p>
                        <p className="truncate text-xs text-muted-foreground">{c["code"] as string}</p>
                      </div>
                      <Badge variant={c["is_system"] ? "secondary" : "outline"} className="shrink-0">
                        {c["is_system"] ? "System" : "Eigene"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Steuerklasse anlegen">
              <div className="flex min-w-0 flex-wrap items-end gap-3">
                <div className="min-w-0 space-y-2">
                  <Label>Name</Label>
                  <Input
                    className="h-11"
                    value={newClass.name}
                    onChange={(e) => setNewClass((s) => ({ ...s, name: e.target.value }))}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Code</Label>
                  <Input
                    className="h-11"
                    value={newClass.code}
                    onChange={(e) => setNewClass((s) => ({ ...s, code: e.target.value }))}
                  />
                </div>
                <Button
                  className="h-11"
                  onClick={() => addClass.mutate()}
                  disabled={!mayManage || !newClass.name || addClass.isPending}
                >
                  Steuerklasse anlegen
                </Button>
              </div>
            </Panel>
          </TabsContent>

          {/* ---------------- Rates ---------------- */}
          <TabsContent value="rates" className="space-y-4 pt-4">
            {rates.length === 0 ? (
              <EmptyState title="Keine Steuersätze" description="Lege unten einen ersten Steuersatz an." />
            ) : (
              <TableScroll>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-4 py-2 font-medium">Steuerklasse</th>
                      <th className="px-4 py-2 font-medium">Land</th>
                      <th className="px-4 py-2 font-medium">Satz</th>
                      <th className="px-4 py-2 font-medium">Kundentyp</th>
                      <th className="px-4 py-2 font-medium">Quelle</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((r) => {
                      const own = !!r["organization_id"];
                      return (
                        <tr key={r["id"] as string} className="border-t border-border">
                          <td className="px-4 py-2">
                            {(classById.get(r["tax_class_id"] as string)?.["name"] as string) ?? "—"}
                          </td>
                          <td className="px-4 py-2">{r["country_code"] as string}</td>
                          <td className="px-4 py-2 tabular-nums">
                            {pct(Number(r["rate_basis_points"]))}
                          </td>
                          <td className="px-4 py-2">{r["customer_type"] as string}</td>
                          <td className="px-4 py-2">
                            <Badge variant={own ? "outline" : "secondary"}>
                              {own ? "Eigen" : "Vorlage"}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {own && mayManage ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9"
                                onClick={() => removeRate.mutate(r["id"] as string)}
                              >
                                Entfernen
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>
            )}

            <Panel title="Steuersatz anlegen">
              <div className="flex min-w-0 flex-wrap items-end gap-3">
                <div className="min-w-0 space-y-2">
                  <Label>Steuerklasse</Label>
                  <Select
                    value={rateDraft.taxClassId}
                    onValueChange={(v) => setRateDraft((s) => ({ ...s, taxClassId: v }))}
                  >
                    <SelectTrigger className="h-11 w-56">
                      <SelectValue placeholder="Wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c["id"] as string} value={c["id"] as string}>
                          {c["name"] as string}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Land</Label>
                  <Input
                    className="h-11 w-24"
                    maxLength={2}
                    value={rateDraft.countryCode}
                    onChange={(e) =>
                      setRateDraft((s) => ({ ...s, countryCode: e.target.value.toUpperCase() }))
                    }
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Satz in %</Label>
                  <Input
                    className="h-11 w-24"
                    value={rateDraft.percent}
                    onChange={(e) => setRateDraft((s) => ({ ...s, percent: e.target.value }))}
                  />
                </div>
                <Button
                  className="h-11"
                  onClick={() => addRate.mutate()}
                  disabled={!mayManage || !rateDraft.taxClassId || addRate.isPending}
                >
                  Steuersatz speichern
                </Button>
              </div>
            </Panel>
          </TabsContent>

          {/* ---------------- Preview ---------------- */}
          <TabsContent value="preview" className="space-y-4 pt-4">
            <Panel title="Steuerrechner">
              <div className="grid min-w-0 gap-4 md:grid-cols-3">
                <div className="min-w-0 space-y-2">
                  <Label>Lieferland</Label>
                  <Input
                    className="h-11"
                    maxLength={2}
                    value={preview.country}
                    onChange={(e) =>
                      setPreview((s) => ({ ...s, country: e.target.value.toUpperCase() }))
                    }
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Kundentyp</Label>
                  <Select
                    value={preview.customerType}
                    onValueChange={(v) =>
                      setPreview((s) => ({ ...s, customerType: v as "consumer" | "business" }))
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consumer">Privatkunde (B2C)</SelectItem>
                      <SelectItem value="business">Geschäftskunde (B2B)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Steuerklasse</Label>
                  <Select
                    value={preview.taxClassId || "default"}
                    onValueChange={(v) =>
                      setPreview((s) => ({ ...s, taxClassId: v === "default" ? "" : v }))
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Standard</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c["id"] as string} value={c["id"] as string}>
                          {c["name"] as string}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Betrag je Stück</Label>
                  <Input
                    className="h-11"
                    value={preview.amount}
                    onChange={(e) => setPreview((s) => ({ ...s, amount: e.target.value }))}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Menge</Label>
                  <Input
                    className="h-11"
                    value={preview.quantity}
                    onChange={(e) => setPreview((s) => ({ ...s, quantity: e.target.value }))}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Versandkosten</Label>
                  <Input
                    className="h-11"
                    value={preview.shipping}
                    onChange={(e) => setPreview((s) => ({ ...s, shipping: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-4 flex min-w-0 items-center gap-3">
                <Switch
                  checked={preview.vatIdValid}
                  onCheckedChange={(v) => setPreview((s) => ({ ...s, vatIdValid: v }))}
                />
                <span className="min-w-0 text-sm">Gültige USt-IdNr. vorhanden (Reverse Charge prüfen)</span>
              </div>
              <Button className="mt-4 h-11" onClick={() => runPreview.mutate()} disabled={runPreview.isPending}>
                Steuer berechnen
              </Button>
            </Panel>

            {result ? (
              <Panel title="Ergebnis">
                <div className="grid min-w-0 gap-2 sm:grid-cols-3">
                  <Info label="Netto" value={formatMoney(result.netTotalMinor, currency)} />
                  <Info label="Steuer" value={formatMoney(result.taxMinor, currency)} />
                  <Info label="Brutto" value={formatMoney(result.grossTotalMinor, currency)} />
                </div>
                <div className="mt-3 min-w-0 space-y-1">
                  {result.breakdown.map((b, i) => (
                    <div key={i} className="flex min-w-0 items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 break-words">
                        {b.label} · {TAX_REASON_LABELS[b.reasonCode] ?? b.reasonCode} ·{" "}
                        {b.countryCode ?? "—"}
                      </span>
                      <span className="shrink-0 tabular-nums">{formatMoney(b.taxMinor, currency)}</span>
                    </div>
                  ))}
                </div>
                {result.notes.length ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {result.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                ) : null}
              </Panel>
            ) : null}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
