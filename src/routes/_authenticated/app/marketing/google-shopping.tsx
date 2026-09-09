import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  disconnectMerchantFn,
  getMerchantConnectionFn,
  listMerchantErrorsFn,
  saveMerchantSettingsFn,
  startMerchantAuthorizationFn,
  syncMerchantNowFn,
} from "@/lib/commerce/store/merchant.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { Panel } from "@/eyis/shell/DetailLayout";
import { EmptyState, ListSkeleton } from "@/eyis/data/States";

export const Route = createFileRoute("/_authenticated/app/marketing/google-shopping")({
  head: () => ({
    meta: [
      { title: "Google Merchant Center – EYIS" },
      {
        name: "description",
        content:
          "Google-Konto verbinden, Produkte automatisch ans Merchant Center übertragen und abgelehnte Artikel einsehen.",
      },
      { property: "og:title", content: "Google Merchant Center – EYIS" },
      {
        property: "og:description",
        content: "Direkte Übertragung von Produkten, Preisen und Lagerstatus zu Google.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GoogleShopping,
});

function GoogleShopping() {
  const { organizationId, shopId } = useActiveWorkspace();
  const qc = useQueryClient();
  const enabled = !!organizationId && !!shopId;

  const load = useServerFn(getMerchantConnectionFn);
  const save = useServerFn(saveMerchantSettingsFn);
  const startAuth = useServerFn(startMerchantAuthorizationFn);
  const disconnect = useServerFn(disconnectMerchantFn);
  const syncNow = useServerFn(syncMerchantNowFn);
  const loadErrors = useServerFn(listMerchantErrorsFn);

  const [merchantId, setMerchantId] = useState("");
  const [label, setLabel] = useState("");
  const [autoSync, setAutoSync] = useState(false);
  const [openRun, setOpenRun] = useState<string | null>(null);

  const state = useQuery({
    queryKey: ["merchant-connection", organizationId, shopId],
    enabled,
    queryFn: async () => {
      const result = await load({ data: { organizationId, shopId } });
      setMerchantId(result.connection?.merchantId ?? "");
      setLabel(result.connection?.accountLabel ?? "");
      setAutoSync(result.connection?.autoSync ?? false);
      return result;
    },
  });

  const errors = useQuery({
    queryKey: ["merchant-errors", openRun],
    enabled: !!openRun,
    queryFn: () => loadErrors({ data: { organizationId, runId: openRun as string } }),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["merchant-connection"] });

  const saveSettings = useMutation({
    mutationFn: () =>
      save({
        data: {
          organizationId,
          shopId,
          merchantId: merchantId.trim() || null,
          accountLabel: label.trim() || null,
          autoSync,
        },
      }),
    onSuccess: () => {
      toast.success("Einstellungen gespeichert.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const connect = useMutation({
    mutationFn: () =>
      startAuth({
        data: {
          organizationId,
          shopId,
          redirectUri: `${window.location.origin}/api/public/merchant/google/callback`,
        },
      }),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => disconnect({ data: { organizationId, shopId } }),
    onSuccess: () => {
      toast.success("Verbindung getrennt.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: () =>
      syncNow({
        data: { organizationId, shopId, requestOrigin: window.location.origin },
      }),
    onSuccess: (result) => {
      toast.success(
        `Übertragen: ${result.itemsOk} Artikel angenommen, ${result.itemsFailed} abgelehnt.`,
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const connection = state.data?.connection ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Google Merchant Center"
        description="Konto verbinden, Produkte direkt übertragen und abgelehnte Artikel einsehen."
      />

      <Panel title="Konto">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={connection?.status === "connected" ? "default" : "secondary"}>
            {connection?.status === "connected"
              ? "Verbunden"
              : connection?.status === "error"
                ? "Fehler"
                : "Nicht verbunden"}
          </Badge>
          {connection?.lastSyncAt ? (
            <span className="text-sm text-muted-foreground">
              Letzte Übertragung: {new Date(connection.lastSyncAt).toLocaleString("de-DE")}
            </span>
          ) : null}
        </div>
        {connection?.lastError ? (
          <p className="mt-3 text-sm text-destructive">{connection.lastError}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => connect.mutate()} disabled={!enabled || connect.isPending}>
            {connection?.status === "connected" ? "Neu verbinden" : "Google-Konto verbinden"}
          </Button>
          {connection?.status === "connected" ? (
            <Button variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending}>
              Verbindung trennen
            </Button>
          ) : null}
        </div>
      </Panel>

      <Panel title="Einstellungen">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="merchant-id">Händler-ID</Label>
            <Input
              id="merchant-id"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              placeholder="123456789"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="merchant-label">Bezeichnung</Label>
            <Input
              id="merchant-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Hauptkonto"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="auto-sync" checked={autoSync} onCheckedChange={setAutoSync} />
            <Label htmlFor="auto-sync">Täglich automatisch übertragen</Label>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => saveSettings.mutate()} disabled={!enabled || saveSettings.isPending}>
            Speichern
          </Button>
          <Button
            variant="secondary"
            onClick={() => sync.mutate()}
            disabled={!enabled || sync.isPending || connection?.status !== "connected"}
          >
            Jetzt übertragen
          </Button>
        </div>
      </Panel>

      <Panel title="Übertragungen">
        {state.isLoading ? (
          <ListSkeleton />
        ) : !state.data?.runs.length ? (
          <EmptyState
            title="Noch keine Übertragung"
            description="Verbinde das Konto und starte die erste Übertragung."
          />
        ) : (
          <ul className="divide-y divide-border">
            {state.data.runs.map((run) => (
              <li key={run.id} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {new Date(run.startedAt).toLocaleString("de-DE")} ·{" "}
                      {run.triggerSource === "schedule" ? "automatisch" : "manuell"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {run.itemsOk} angenommen · {run.itemsFailed} abgelehnt · {run.itemsTotal}{" "}
                      insgesamt
                    </p>
                  </div>
                  <Badge
                    variant={
                      run.status === "completed"
                        ? "default"
                        : run.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {run.status}
                  </Badge>
                  {run.itemsFailed > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOpenRun(openRun === run.id ? null : run.id)}
                    >
                      {openRun === run.id ? "Fehler ausblenden" : "Fehler anzeigen"}
                    </Button>
                  ) : null}
                </div>
                {run.message ? (
                  <p className="mt-1 text-sm text-muted-foreground">{run.message}</p>
                ) : null}
                {openRun === run.id ? (
                  errors.isLoading ? (
                    <ListSkeleton />
                  ) : (
                    <ul className="mt-3 space-y-2 rounded-md bg-muted/40 p-3">
                      {(errors.data ?? []).map((err) => (
                        <li key={err.id} className="text-sm">
                          <span className="font-medium">{err.productTitle ?? err.offerId}</span>
                          {": "}
                          {err.message}
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
