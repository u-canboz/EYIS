import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getReturnSettingsFn, saveReturnSettingsFn } from "@/lib/commerce/returns/return.functions";
import type {
  ReturnApprovalStrategy,
  ReturnSettings,
  ReturnWindowStart,
} from "@/lib/commerce/returns/return.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/retouren/einstellungen")({
  head: () => ({
    meta: [
      { title: "Retouren-Einstellungen – Commerce OS" },
      {
        name: "description",
        content: "Rückgabefrist, Genehmigungsstrategie, Rücksendekosten und Einlagerung festlegen.",
      },
      { property: "og:title", content: "Retouren-Einstellungen – Commerce OS" },
      { property: "og:description", content: "Retourenregeln pro Shop konfigurieren." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReturnSettingsPage,
});

function ReturnSettingsPage() {
  const { organizationId, shopId, can } = useActiveWorkspace();
  const fetchSettings = useServerFn(getReturnSettingsFn);
  const saveSettings = useServerFn(saveReturnSettingsFn);
  const [draft, setDraft] = useState<ReturnSettings | null>(null);

  const settings = useQuery({
    queryKey: ["return-settings", organizationId, shopId],
    enabled: !!organizationId && !!shopId,
    queryFn: () => fetchSettings({ data: { organizationId, shopId } }),
  });

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("Noch nicht geladen.");
      const { shopId: _ignored, ...rest } = draft;
      return saveSettings({ data: { organizationId, shopId, settings: rest } });
    },
    onSuccess: () => toast.success("Einstellungen gespeichert."),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!draft) return <Skeleton className="h-96 w-full" />;
  const set = <K extends keyof ReturnSettings>(key: K, value: ReturnSettings[K]) =>
    setDraft({ ...draft, [key]: value });

  return (
    <div className="space-y-6">
      <header>
        <Link to="/app/retouren" className="text-xs text-muted-foreground hover:underline">
          ← Zurück zu Retouren
        </Link>
        <h1 className="font-display text-2xl font-semibold">Retouren-Einstellungen</h1>
        <p className="text-sm text-muted-foreground">Regeln gelten für den aktiven Shop.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rückgaberegeln</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm">Retouren aktiviert</span>
            <Switch
              checked={draft.returnsEnabled}
              onCheckedChange={(v) => set("returnsEnabled", v)}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Rückgabefrist (Tage)</Label>
              <Input
                type="number"
                min={0}
                value={draft.defaultReturnWindowDays}
                onChange={(e) => set("defaultReturnWindowDays", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Frist beginnt ab</Label>
              <Select
                value={draft.windowStart}
                onValueChange={(v) => set("windowStart", v as ReturnWindowStart)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="order_date">Bestelldatum</SelectItem>
                  <SelectItem value="shipping_date">Versanddatum</SelectItem>
                  <SelectItem value="delivery_date">Zustelldatum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Genehmigung</Label>
            <Select
              value={draft.approvalStrategy}
              onValueChange={(v) => set("approvalStrategy", v as ReturnApprovalStrategy)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manuell prüfen</SelectItem>
                <SelectItem value="automatic_rules">Automatisch nach Regeln</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center justify-between gap-4">
            <span className="text-sm">Kunde trägt Rücksendekosten</span>
            <Switch
              checked={draft.customerPaysReturnShipping}
              onCheckedChange={(v) => set("customerPaysReturnShipping", v)}
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm">Automatische Erstattung nach Genehmigung</span>
            <Switch
              checked={draft.autoRefundOnApproval}
              onCheckedChange={(v) => set("autoRefundOnApproval", v)}
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm">Ware automatisch einlagern (nur Zustand „neuwertig“)</span>
            <Switch checked={draft.autoRestock} onCheckedChange={(v) => set("autoRestock", v)} />
          </label>

          <div>
            <Label>Rücksendehinweise für Kund:innen</Label>
            <Textarea
              value={draft.instructions ?? ""}
              onChange={(e) => set("instructions", e.target.value)}
              placeholder="z. B. Rücksendeadresse und Verpackungshinweise"
            />
          </div>

          <Button disabled={!can("returns.manage") || save.isPending} onClick={() => save.mutate()}>
            Speichern
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
