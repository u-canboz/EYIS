import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, StickyActionBar } from "@/components/shell/PageHeader";
import { Panel } from "@/components/shell/DetailLayout";

export const Route = createFileRoute("/_authenticated/app/retouren/einstellungen")({
  head: () => ({
    meta: [
      { title: "Retouren-Einstellungen – EYIS" },
      {
        name: "description",
        content: "Rückgabefrist, Genehmigungsstrategie, Rücksendekosten und Einlagerung festlegen.",
      },
      { property: "og:title", content: "Retouren-Einstellungen – EYIS" },
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

  if (!draft)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  const set = <K extends keyof ReturnSettings>(key: K, value: ReturnSettings[K]) =>
    setDraft({ ...draft, [key]: value });

  return (
    <div className="min-w-0 space-y-5 pb-4">
      <PageHeader
        eyebrow={
          <Link
            to="/app/retouren"
            className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
            Zurück zu Retouren
          </Link>
        }
        title="Retouren-Einstellungen"
        description="Regeln gelten für den aktiven Shop."
      />

      <Panel title="Rückgaberegeln" bodyClassName="space-y-5">
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm">Retouren aktiviert</span>
          <Switch
            checked={draft.returnsEnabled}
            onCheckedChange={(v) => set("returnsEnabled", v)}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Rückgabefrist (Tage)</Label>
            <Input
              className="h-11"
              type="number"
              min={0}
              value={draft.defaultReturnWindowDays}
              onChange={(e) => set("defaultReturnWindowDays", Number(e.target.value))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Frist beginnt ab</Label>
            <Select
              value={draft.windowStart}
              onValueChange={(v) => set("windowStart", v as ReturnWindowStart)}
            >
              <SelectTrigger className="h-11">
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

        <div className="grid gap-1.5">
          <Label className="text-xs">Genehmigung</Label>
          <Select
            value={draft.approvalStrategy}
            onValueChange={(v) => set("approvalStrategy", v as ReturnApprovalStrategy)}
          >
            <SelectTrigger className="h-11">
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

        <div className="grid gap-1.5">
          <Label className="text-xs">Rücksendehinweise für Kund:innen</Label>
          <Textarea
            value={draft.instructions ?? ""}
            onChange={(e) => set("instructions", e.target.value)}
            placeholder="z. B. Rücksendeadresse und Verpackungshinweise"
          />
        </div>
      </Panel>

      <StickyActionBar className="sm:static sm:mt-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button
          className="h-11 w-full sm:w-auto"
          disabled={!can("returns.manage") || save.isPending}
          onClick={() => save.mutate()}
        >
          Speichern
        </Button>
      </StickyActionBar>
    </div>
  );
}
