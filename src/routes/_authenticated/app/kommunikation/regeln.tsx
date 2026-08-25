import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listProvidersFn,
  listRulesFn,
  listSuppressionsFn,
  removeSuppressionFn,
  saveProviderFn,
  saveSenderIdentityFn,
  updateRuleFn,
} from "@/lib/commerce/communications/communication.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/kommunikation/regeln")({
  head: () => ({
    meta: [
      { title: "Regeln & Anbieter – Commerce OS" },
      {
        name: "description",
        content:
          "Festlegen, welches Ereignis welche E-Mail auslöst, Absenderadressen pflegen und Sperrliste verwalten.",
      },
      { property: "og:title", content: "Regeln & Anbieter – Commerce OS" },
      { property: "og:description", content: "Auslöser, Absender und Zustellung konfigurieren." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RulesPage,
});

function RulesPage() {
  const { organizationId, shopId } = useActiveWorkspace();
  const fetchRules = useServerFn(listRulesFn);
  const updateRule = useServerFn(updateRuleFn);
  const fetchProviders = useServerFn(listProvidersFn);
  const saveProvider = useServerFn(saveProviderFn);
  const saveSender = useServerFn(saveSenderIdentityFn);
  const fetchSuppressions = useServerFn(listSuppressionsFn);
  const removeSuppression = useServerFn(removeSuppressionFn);

  const [busy, setBusy] = useState(false);
  const [sender, setSender] = useState({ displayName: "", senderName: "", senderAddress: "", replyTo: "" });

  const rules = useQuery({
    queryKey: ["communication-rules", organizationId, shopId],
    enabled: !!organizationId && !!shopId,
    queryFn: () => fetchRules({ data: { organizationId, shopId } }),
  });
  const providers = useQuery({
    queryKey: ["communication-providers", organizationId, shopId],
    enabled: !!organizationId && !!shopId,
    queryFn: () => fetchProviders({ data: { organizationId, shopId } }),
  });
  const suppressions = useQuery({
    queryKey: ["communication-suppressions", organizationId],
    enabled: !!organizationId,
    queryFn: () => fetchSuppressions({ data: { organizationId } }),
  });

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <Link to="/app/kommunikation" className="text-xs text-muted-foreground hover:underline">
          ← Kommunikation
        </Link>
        <h1 className="font-display text-2xl font-semibold">Regeln & Anbieter</h1>
        <p className="text-sm text-muted-foreground">
          Ereignisse lösen Nachrichten aus. Ohne aktive Regel wird nichts versendet.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Auslöser</h2>
        {rules.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ul className="divide-y rounded-lg border">
            {(rules.data ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{r.templateName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.eventType} → {r.templateKey}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`delay-${r.id}`} className="text-xs">
                      Verzögerung (Sek.)
                    </Label>
                    <Input
                      id={`delay-${r.id}`}
                      type="number"
                      min={0}
                      className="h-8 w-24"
                      defaultValue={r.delaySeconds}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (value === r.delaySeconds) return;
                        void run("Regel aktualisiert.", async () => {
                          await updateRule({
                            data: { organizationId, ruleId: r.id, delaySeconds: value },
                          });
                          await rules.refetch();
                        });
                      }}
                    />
                  </div>
                  <Switch
                    checked={r.enabled}
                    disabled={busy}
                    aria-label={`${r.templateName} aktivieren`}
                    onCheckedChange={(checked) =>
                      run(checked ? "Regel aktiviert." : "Regel deaktiviert.", async () => {
                        await updateRule({
                          data: { organizationId, ruleId: r.id, enabled: checked },
                        });
                        await rules.refetch();
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Anbieter</h2>
        {providers.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <ul className="divide-y rounded-lg border">
            {(providers.data?.available ?? []).map((p) => {
              const config = providers.data?.configs.find((c) => c.provider === p.key);
              const active = config?.status === "active";
              return (
                <li key={p.key} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{p.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.isSandbox
                        ? "Interner Testversand – verlässt die Plattform niemals."
                        : "Echter Versand über den verwalteten E-Mail-Dienst."}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.isSandbox && <Badge variant="outline">Sandbox</Badge>}
                    <Switch
                      checked={active}
                      disabled={busy}
                      aria-label={`${p.label} aktivieren`}
                      onCheckedChange={(checked) =>
                        run("Anbieter aktualisiert.", async () => {
                          await saveProvider({
                            data: {
                              organizationId,
                              shopId,
                              provider: p.key,
                              displayName: p.label,
                              status: checked ? "active" : "inactive",
                              testMode: p.isSandbox,
                              priority: config?.priority ?? (p.isSandbox ? 100 : 10),
                            },
                          });
                          await providers.refetch();
                        })
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Absender</h2>
        <ul className="divide-y rounded-lg border">
          {(providers.data?.senders ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">
                  {s.senderName} &lt;{s.senderAddress}&gt;
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.displayName}
                  {s.replyTo ? ` · Antwort an ${s.replyTo}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{s.verificationStatus}</Badge>
                {s.isDefault ? (
                  <Badge variant="secondary">Standard</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run("Standardabsender gesetzt.", async () => {
                        await saveSender({
                          data: {
                            organizationId,
                            shopId,
                            id: s.id,
                            displayName: s.displayName,
                            senderName: s.senderName,
                            senderAddress: s.senderAddress,
                            replyTo: s.replyTo,
                            isDefault: true,
                          },
                        });
                        await providers.refetch();
                      })
                    }
                  >
                    Als Standard
                  </Button>
                )}
              </div>
            </li>
          ))}
          <li className="grid gap-3 p-4 sm:grid-cols-5">
            <Input
              placeholder="Bezeichnung"
              value={sender.displayName}
              onChange={(e) => setSender({ ...sender, displayName: e.target.value })}
            />
            <Input
              placeholder="Absendername"
              value={sender.senderName}
              onChange={(e) => setSender({ ...sender, senderName: e.target.value })}
            />
            <Input
              placeholder="absender@example.com"
              value={sender.senderAddress}
              onChange={(e) => setSender({ ...sender, senderAddress: e.target.value })}
            />
            <Input
              placeholder="Antwort an (optional)"
              value={sender.replyTo}
              onChange={(e) => setSender({ ...sender, replyTo: e.target.value })}
            />
            <Button
              disabled={busy || !sender.senderAddress || !sender.senderName}
              onClick={() =>
                run("Absender gespeichert.", async () => {
                  await saveSender({
                    data: {
                      organizationId,
                      shopId,
                      displayName: sender.displayName || sender.senderName,
                      senderName: sender.senderName,
                      senderAddress: sender.senderAddress,
                      replyTo: sender.replyTo || null,
                      isDefault: !(providers.data?.senders ?? []).length,
                    },
                  });
                  setSender({ displayName: "", senderName: "", senderAddress: "", replyTo: "" });
                  await providers.refetch();
                })
              }
            >
              Hinzufügen
            </Button>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Sperrliste</h2>
        <p className="text-sm text-muted-foreground">
          Adressen mit harten Zustellfehlern oder Beschwerden werden automatisch gesperrt.
        </p>
        {!suppressions.data?.length ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            Keine gesperrten Adressen.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {suppressions.data.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span>
                  {s.recipient} · {s.reason}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run("Sperre aufgehoben.", async () => {
                      await removeSuppression({ data: { organizationId, suppressionId: s.id } });
                      await suppressions.refetch();
                    })
                  }
                >
                  Entsperren
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
