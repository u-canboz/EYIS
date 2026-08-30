import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  authorizeReturnFn,
  cancelReturnFn,
  completeReturnFn,
  getReturnFn,
  inspectReturnFn,
  markReturnInTransitFn,
  receiveReturnFn,
  rejectReturnFn,
  restockReturnItemFn,
  settleReturnFn,
  startReturnInspectionFn,
} from "@/lib/commerce/returns/return.functions";
import { listLocations } from "@/lib/commerce/inventory.functions";
import {
  CONDITION_LABELS,
  RESTOCK_LABELS,
  RETURN_REASON_LABELS,
  RETURN_STATUS_LABELS,
  nextReturnAction,
  type ReturnItemCondition,
  type RestockDecision,
} from "@/lib/commerce/returns/return.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney } from "@/lib/commerce/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { Panel } from "@/eyis/shell/DetailLayout";
import { ErrorState, EmptyState } from "@/eyis/data/States";

export const Route = createFileRoute("/_authenticated/app/retouren/$returnId")({
  head: () => ({
    meta: [
      { title: "Retoure bearbeiten – EYIS" },
      {
        name: "description",
        content: "Retoure prüfen, Wareneingang buchen, einlagern und Erstattung auslösen.",
      },
      { property: "og:title", content: "Retoure bearbeiten – EYIS" },
      { property: "og:description", content: "Der komplette RMA-Prozess in einer Ansicht." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReturnDetailPage,
  errorComponent: ({ error }) => <ErrorState description={(error as Error).message} />,
  notFoundComponent: () => <EmptyState title="Retoure nicht gefunden" />,
});

type ReceiveDraft = Record<string, { qty: number; condition: ReturnItemCondition }>;
type InspectDraft = Record<
  string,
  { qty: number; condition: ReturnItemCondition; restock: RestockDecision; note: string }
>;

function ReturnDetailPage() {
  const { returnId } = Route.useParams();
  const queryClient = useQueryClient();
  const { organizationId, shopId, can } = useActiveWorkspace();
  const [rejectReason, setRejectReason] = useState("");
  const [receive, setReceive] = useState<ReceiveDraft>({});
  const [inspect, setInspect] = useState<InspectDraft>({});
  const [createCreditNote, setCreateCreditNote] = useState(true);
  const [locationId, setLocationId] = useState("");

  const fetchReturn = useServerFn(getReturnFn);
  const fetchLocations = useServerFn(listLocations);
  const authorize = useServerFn(authorizeReturnFn);
  const reject = useServerFn(rejectReturnFn);
  const inTransit = useServerFn(markReturnInTransitFn);
  const receiveFn = useServerFn(receiveReturnFn);
  const startInspection = useServerFn(startReturnInspectionFn);
  const inspectFn = useServerFn(inspectReturnFn);
  const restock = useServerFn(restockReturnItemFn);
  const settle = useServerFn(settleReturnFn);
  const complete = useServerFn(completeReturnFn);
  const cancel = useServerFn(cancelReturnFn);

  const detail = useQuery({
    queryKey: ["return", organizationId, returnId],
    enabled: !!organizationId,
    queryFn: () => fetchReturn({ data: { organizationId, returnId } }),
  });

  const locations = useQuery({
    queryKey: ["inventory-locations", organizationId, shopId],
    enabled: !!organizationId && !!shopId,
    queryFn: () => fetchLocations({ data: { organizationId, shopId } }),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["return", organizationId, returnId] });
  const run = <T,>(fn: () => Promise<T>, message: string) =>
    ({
      mutationFn: fn,
      onSuccess: () => {
        toast.success(message);
        refresh();
      },
      onError: (e: Error) => toast.error(e.message),
    }) as const;

  const r = detail.data;
  const action = useMemo(() => (r ? nextReturnAction(r.status) : null), [r]);

  const authorizeM = useMutation(
    run(() => authorize({ data: { organizationId, returnId } }), "Retoure genehmigt."),
  );
  const rejectM = useMutation(
    run(
      () => reject({ data: { organizationId, returnId, reason: rejectReason } }),
      "Retoure abgelehnt.",
    ),
  );
  const transitM = useMutation(
    run(() => inTransit({ data: { organizationId, returnId } }), "Als unterwegs markiert."),
  );
  const receiveM = useMutation(
    run(
      () =>
        receiveFn({
          data: {
            organizationId,
            returnId,
            items: Object.entries(receive).map(([returnItemId, v]) => ({
              returnItemId,
              quantityReceived: v.qty,
              condition: v.condition,
            })),
            idempotencyKey: `receive-${returnId}`,
          },
        }),
      "Wareneingang gebucht.",
    ),
  );
  const startM = useMutation(
    run(() => startInspection({ data: { organizationId, returnId } }), "Prüfung gestartet."),
  );
  const inspectM = useMutation(
    run(
      () =>
        inspectFn({
          data: {
            organizationId,
            returnId,
            items: Object.entries(inspect).map(([returnItemId, v]) => ({
              returnItemId,
              quantityApproved: v.qty,
              condition: v.condition,
              restockDecision: v.restock,
              note: v.note || null,
            })),
            idempotencyKey: `inspect-${returnId}`,
          },
        }),
      "Prüfergebnis erfasst.",
    ),
  );
  const settleM = useMutation(
    run(
      () => settle({ data: { organizationId, returnId, createCreditNote } }),
      "Erstattung ausgelöst.",
    ),
  );
  const completeM = useMutation(
    run(() => complete({ data: { organizationId, returnId } }), "Retoure abgeschlossen."),
  );
  const cancelM = useMutation(
    run(() => cancel({ data: { organizationId, returnId } }), "Retoure storniert."),
  );
  const restockM = useMutation({
    mutationFn: (returnItemId: string) => {
      if (!locationId) throw new Error("Bitte zuerst einen Lagerort wählen.");
      return restock({ data: { organizationId, returnItemId, locationId } });
    },
    onSuccess: () => {
      toast.success("Position eingelagert.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (detail.isLoading || !r)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );

  const receiveDraft = (id: string, fallbackQty: number) =>
    receive[id] ?? { qty: fallbackQty, condition: "unopened" as ReturnItemCondition };
  const inspectDraft = (id: string, fallbackQty: number) =>
    inspect[id] ?? {
      qty: fallbackQty,
      condition: "unopened" as ReturnItemCondition,
      restock: "restock" as RestockDecision,
      note: "",
    };

  return (
    <div className="min-w-0 space-y-5">
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
        title={r.returnNumber}
        description={
          <>
            Bestellung{" "}
            <Link
              to="/app/bestellungen/$orderId"
              params={{ orderId: r.orderId }}
              className="hover:underline"
            >
              {r.orderNumber}
            </Link>{" "}
            · {RETURN_REASON_LABELS[r.reasonCategory]} · {r.customerEmail ?? "Gast"}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{RETURN_STATUS_LABELS[r.status]}</Badge>
            {["requested", "authorized"].includes(r.status) && can("returns.manage") && (
              <Button size="sm" className="h-11" variant="outline" onClick={() => cancelM.mutate()}>
                Stornieren
              </Button>
            )}
          </div>
        }
      />

      {action && (
        <Panel title={`Nächster Schritt: ${action.label}`} bodyClassName="space-y-4">
            {!action.permission || can(action.permission) ? (
              <>
                {action.key === "authorize" && (
                  <div className="space-y-3">
                    <Button onClick={() => authorizeM.mutate()} disabled={authorizeM.isPending}>
                      Retoure genehmigen
                    </Button>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ablehnungsgrund"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <Button
                        variant="destructive"
                        disabled={!rejectReason.trim()}
                        onClick={() => rejectM.mutate()}
                      >
                        Ablehnen
                      </Button>
                    </div>
                  </div>
                )}
                {action.key === "in_transit" && (
                  <Button onClick={() => transitM.mutate()} disabled={transitM.isPending}>
                    Als unterwegs markieren
                  </Button>
                )}
                {action.key === "receive" && (
                  <div className="space-y-3">
                    {r.items.map((it) => {
                      const d = receiveDraft(it.id, it.quantityRequested);
                      return (
                        <div
                          key={it.id}
                          className="grid gap-2 rounded-md border p-3 sm:grid-cols-3"
                        >
                          <div className="text-sm">
                            <p className="font-medium">{it.title}</p>
                            <p className="text-xs text-muted-foreground">
                              beantragt: {it.quantityRequested}
                            </p>
                          </div>
                          <Input
                            type="number"
                            min={0}
                            max={it.quantityRequested}
                            value={d.qty}
                            onChange={(e) =>
                              setReceive({
                                ...receive,
                                [it.id]: { ...d, qty: Number(e.target.value) },
                              })
                            }
                          />
                          <Select
                            value={d.condition}
                            onValueChange={(v) =>
                              setReceive({
                                ...receive,
                                [it.id]: { ...d, condition: v as ReturnItemCondition },
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(CONDITION_LABELS).map(([k, label]) => (
                                <SelectItem key={k} value={k}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                    <Button
                      onClick={() => {
                        if (!Object.keys(receive).length) {
                          setReceive(
                            Object.fromEntries(
                              r.items.map((it) => [
                                it.id,
                                {
                                  qty: it.quantityRequested,
                                  condition: "unopened" as ReturnItemCondition,
                                },
                              ]),
                            ),
                          );
                        }
                        receiveM.mutate();
                      }}
                      disabled={receiveM.isPending}
                    >
                      Wareneingang buchen
                    </Button>
                  </div>
                )}
                {action.key === "inspect" && (
                  <Button onClick={() => startM.mutate()} disabled={startM.isPending}>
                    Prüfung starten
                  </Button>
                )}
                {action.key === "decide" && (
                  <div className="space-y-3">
                    {r.items.map((it) => {
                      const d = inspectDraft(it.id, it.quantityReceived || it.quantityRequested);
                      return (
                        <div
                          key={it.id}
                          className="grid gap-2 rounded-md border p-3 sm:grid-cols-4"
                        >
                          <div className="text-sm">
                            <p className="font-medium">{it.title}</p>
                            <p className="text-xs text-muted-foreground">
                              erhalten: {it.quantityReceived}
                            </p>
                          </div>
                          <Input
                            type="number"
                            min={0}
                            max={it.quantityReceived || it.quantityRequested}
                            value={d.qty}
                            onChange={(e) =>
                              setInspect({
                                ...inspect,
                                [it.id]: { ...d, qty: Number(e.target.value) },
                              })
                            }
                          />
                          <Select
                            value={d.condition}
                            onValueChange={(v) =>
                              setInspect({
                                ...inspect,
                                [it.id]: { ...d, condition: v as ReturnItemCondition },
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(CONDITION_LABELS).map(([k, label]) => (
                                <SelectItem key={k} value={k}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={d.restock}
                            onValueChange={(v) =>
                              setInspect({
                                ...inspect,
                                [it.id]: { ...d, restock: v as RestockDecision },
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(RESTOCK_LABELS).map(([k, label]) => (
                                <SelectItem key={k} value={k}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                    <Button
                      onClick={() => {
                        if (!Object.keys(inspect).length) {
                          setInspect(
                            Object.fromEntries(
                              r.items.map((it) => [
                                it.id,
                                {
                                  qty: it.quantityReceived || it.quantityRequested,
                                  condition: "unopened" as ReturnItemCondition,
                                  restock: "restock" as RestockDecision,
                                  note: "",
                                },
                              ]),
                            ),
                          );
                        }
                        inspectM.mutate();
                      }}
                      disabled={inspectM.isPending}
                    >
                      Prüfergebnis speichern
                    </Button>
                  </div>
                )}
                {action.key === "settle" && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={createCreditNote}
                        onCheckedChange={(v) => setCreateCreditNote(Boolean(v))}
                      />
                      Gutschrift zur Rechnung erzeugen
                    </label>
                    <Button onClick={() => settleM.mutate()} disabled={settleM.isPending}>
                      Erstattung über {formatMoney(r.refundTotalMinor, r.currencyCode)} auslösen
                    </Button>
                  </div>
                )}
                {action.key === "complete" && (
                  <Button onClick={() => completeM.mutate()} disabled={completeM.isPending}>
                    Retoure abschließen
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Dir fehlt die Berechtigung für diesen Schritt ({action.permission}).
              </p>
            )}
      </Panel>
      )}

      <Panel
        title="Positionen"
        bodyClassName="space-y-2"
        actions={
          can("inventory.manage") ? (
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger aria-label="Einlagerungs-Lagerort" className="h-11 w-56">
                <SelectValue placeholder="Einlagerungs-Lagerort" />
              </SelectTrigger>
              <SelectContent>
                {(locations.data ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      >
          {r.items.map((it) => (
            <div
              key={it.id}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="min-w-0 break-words font-medium">
                  {it.title} {it.variantTitle ? `· ${it.variantTitle}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  beantragt {it.quantityRequested} · erhalten {it.quantityReceived} · genehmigt{" "}
                  {it.quantityApproved} · {CONDITION_LABELS[it.condition]} ·{" "}
                  {RESTOCK_LABELS[it.restockDecision]}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="tabular-nums">{formatMoney(it.refundAmountMinor ?? 0, r.currencyCode)}</span>
                {it.restockDecision === "restock" && !it.restockedAt && can("inventory.manage") && (
                  <Button size="sm" className="min-h-11" variant="outline" onClick={() => restockM.mutate(it.id)}>
                    Einlagern
                  </Button>
                )}
                {it.restockedAt && <Badge variant="secondary">eingelagert</Badge>}
              </div>
            </div>
          ))}
      </Panel>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <Panel title="Details" bodyClassName="space-y-2 text-sm">
          <p>Erstattung gesamt: <span className="tabular-nums">{formatMoney(r.refundTotalMinor, r.currencyCode)}</span></p>
          <p>Versandkosten-Erstattung: <span className="tabular-nums">{formatMoney(r.shippingRefundMinor, r.currencyCode)}</span></p>
          {r.customerNote && (
            <div>
              <Label className="text-xs">Kundennachricht</Label>
              <Textarea readOnly value={r.customerNote} className="mt-1" />
            </div>
          )}
          {r.rejectionReason && <p className="text-destructive">Ablehnung: {r.rejectionReason}</p>}
        </Panel>

        <Panel title="Verlauf" bodyClassName="space-y-2 text-sm">
          {!r.timeline.length ? (
            <p className="text-muted-foreground">Noch keine Ereignisse.</p>
          ) : (
            r.timeline.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border py-1 last:border-none"
              >
                <span className="min-w-0 break-words">{t.action}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {new Date(t.createdAt).toLocaleString("de-DE")}
                </span>
              </div>
            ))
          )}
        </Panel>
      </div>
    </div>
  );
}
