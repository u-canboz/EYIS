import { useMemo, useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import {
  getAutomationFn,
  saveAutomationFn,
  publishAutomationFn,
  dryRunAutomationFn,
  listExecutionsFn,
  listWebhookEndpointsFn,
} from "@/lib/commerce/automation/automation.functions";
import { listTemplatesFn } from "@/lib/commerce/communications/communication.functions";
import type { Condition, ConditionGroup } from "@/lib/commerce/automation/automation.types";
import {
  AUTOMATION_STATUS_LABELS,
  EXECUTION_STATUS_LABELS,
} from "@/lib/commerce/automation/automation.types";
import {
  EVENT_REGISTRY,
  CATEGORY_LABELS,
  findEvent,
  operatorsFor,
  OPERATOR_LABELS,
} from "@/lib/commerce/automation/event-registry";
import { ACTION_REGISTRY, findAction } from "@/lib/commerce/automation/action-registry";
import { describeRule } from "@/lib/commerce/automation/summary";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, StickyActionBar } from "@/components/shell/PageHeader";
import { DetailLayout, Panel } from "@/components/shell/DetailLayout";

export const Route = createFileRoute("/_authenticated/app/automationen/regel/$ruleId")({
  head: () => ({
    meta: [
      { title: "Automation bearbeiten – Commerce OS" },
      {
        name: "description",
        content:
          "Auslöser, Bedingungen und Aktionen einer Automation festlegen, im Testlauf prüfen und veröffentlichen.",
      },
      { property: "og:title", content: "Automation bearbeiten – Commerce OS" },
      {
        property: "og:description",
        content: "Regeln definieren, testen und kontrolliert aktivieren.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RuleEditor,
});

type ActionDraft = {
  position: number;
  actionType: string;
  config: Record<string, unknown>;
  delaySeconds: number;
  continueOnFailure: boolean;
};

const SCHEDULE_KINDS = [
  { value: "abandoned_carts", label: "Liegengebliebene Warenkörbe" },
  { value: "unfulfilled_orders", label: "Nicht versandte Bestellungen" },
  { value: "low_stock", label: "Niedrige Bestände" },
  { value: "overdue_invoices", label: "Überfällige Rechnungen" },
  { value: "pending_returns", label: "Offene Retouren" },
];

function RuleEditor() {
  const { ruleId } = Route.useParams();
  const isNew = ruleId === "neu";
  const { organizationId, shopId } = useActiveWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const enabled = !!organizationId && !!shopId;

  const fetchRule = useServerFn(getAutomationFn);
  const save = useServerFn(saveAutomationFn);
  const publish = useServerFn(publishAutomationFn);
  const dryRun = useServerFn(dryRunAutomationFn);
  const fetchExecutions = useServerFn(listExecutionsFn);
  const fetchEndpoints = useServerFn(listWebhookEndpointsFn);
  const fetchTemplates = useServerFn(listTemplatesFn);

  const rule = useQuery({
    queryKey: ["automation", organizationId, ruleId],
    enabled: enabled && !isNew,
    queryFn: () => fetchRule({ data: { organizationId, ruleId } }),
  });
  const endpoints = useQuery({
    queryKey: ["webhook-endpoints", organizationId, shopId],
    enabled,
    queryFn: () => fetchEndpoints({ data: { organizationId, shopId } }),
  });
  const templates = useQuery({
    queryKey: ["communication-templates", organizationId, shopId],
    enabled,
    queryFn: () => fetchTemplates({ data: { organizationId, shopId } }),
  });
  const executions = useQuery({
    queryKey: ["automation-executions", organizationId, shopId, ruleId],
    enabled: enabled && !isNew,
    queryFn: () => fetchExecutions({ data: { organizationId, shopId, ruleId, limit: 15 } }),
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<"domain_event" | "schedule" | "manual">(
    "domain_event",
  );
  const [eventType, setEventType] = useState("order.paid");
  const [scheduleKind, setScheduleKind] = useState("unfulfilled_orders");
  const [everyMinutes, setEveryMinutes] = useState(60);
  const [olderThanHours, setOlderThanHours] = useState(24);
  const [mode, setMode] = useState<"all" | "any">("all");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<ActionDraft[]>([]);
  const [stopOnError, setStopOnError] = useState(true);
  const [maxPerHour, setMaxPerHour] = useState<string>("");
  const [maxPerEntity, setMaxPerEntity] = useState<string>("");
  const [dryResult, setDryResult] = useState<Awaited<ReturnType<typeof dryRun>> | null>(null);

  useEffect(() => {
    const r = rule.data;
    if (!r) return;
    setName(r.name);
    setDescription(r.description ?? "");
    setTriggerType(r.triggerType as "domain_event" | "schedule" | "manual");
    const cfg = r.triggerConfig ?? {};
    if (cfg["eventType"]) setEventType(String(cfg["eventType"]));
    if (cfg["scheduleKind"]) setScheduleKind(String(cfg["scheduleKind"]));
    if (cfg["everyMinutes"]) setEveryMinutes(Number(cfg["everyMinutes"]));
    if (cfg["olderThanHours"]) setOlderThanHours(Number(cfg["olderThanHours"]));
    setMode((r.conditions?.mode as "all" | "any") ?? "all");
    setConditions(((r.conditions?.conditions ?? []) as Condition[]).filter((c) => "field" in c));
    setActions(
      r.actions.map((a, i) => ({
        position: i + 1,
        actionType: a.actionType,
        config: a.config ?? {},
        delaySeconds: a.delaySeconds ?? 0,
        continueOnFailure: a.continueOnFailure ?? false,
      })),
    );
    setStopOnError(r.stopOnError);
    setMaxPerHour(r.maxPerHour ? String(r.maxPerHour) : "");
    setMaxPerEntity(r.maxPerEntity ? String(r.maxPerEntity) : "");
  }, [rule.data]);

  const event = useMemo(() => findEvent(eventType), [eventType]);

  const triggerConfig = useMemo<Record<string, unknown>>(() => {
    if (triggerType === "domain_event") return { eventType };
    if (triggerType === "schedule") return { scheduleKind, everyMinutes, olderThanHours };
    return {};
  }, [triggerType, eventType, scheduleKind, everyMinutes, olderThanHours]);

  const conditionGroup: ConditionGroup = { mode, conditions };

  const summary = describeRule({ triggerType, triggerConfig, conditions: conditionGroup, actions });

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          organizationId,
          shopId,
          ruleId: isNew ? null : ruleId,
          name,
          description: description || null,
          triggerType,
          triggerConfig,
          conditions: conditionGroup,
          actions: actions.map((a, i) => ({ ...a, position: i + 1 })),
          stopOnError,
          maxPerHour: maxPerHour ? Number(maxPerHour) : null,
          maxPerEntity: maxPerEntity ? Number(maxPerEntity) : null,
        },
      }),
    onSuccess: (res: { ruleId: string }) => {
      toast.success("Entwurf gespeichert.");
      void qc.invalidateQueries({ queryKey: ["automations"] });
      void qc.invalidateQueries({ queryKey: ["automation"] });
      if (isNew)
        void navigate({ to: "/app/automationen/regel/$ruleId", params: { ruleId: res.ruleId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: () => publish({ data: { organizationId, ruleId } }),
    onSuccess: () => {
      toast.success("Automation ist aktiv.");
      void qc.invalidateQueries({ queryKey: ["automation"] });
      void qc.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dryRunMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      dryRun({ data: { organizationId, ruleId, payload } }),
    onSuccess: (res) => setDryResult(res),
    onError: (e: Error) => toast.error(e.message),
  });

  const samplePayload = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const f of event?.fields ?? []) {
      out[f.path] =
        f.type === "number" || f.type === "money"
          ? 10000
          : f.type === "boolean"
            ? true
            : "beispiel";
    }
    return out;
  }, [event]);

  const [payloadText, setPayloadText] = useState("");
  useEffect(() => setPayloadText(JSON.stringify(samplePayload, null, 2)), [samplePayload]);

  const addCondition = () => {
    const first = event?.fields[0];
    setConditions((c) => [
      ...c,
      { field: first?.path ?? "", operator: "equals", value: "" } as Condition,
    ]);
  };

  const updateCondition = (i: number, patch: Partial<Condition>) =>
    setConditions((c) => c.map((cond, idx) => (idx === i ? { ...cond, ...patch } : cond)));

  const addAction = (type: string) =>
    setActions((a) => [
      ...a,
      {
        position: a.length + 1,
        actionType: type,
        config: {},
        delaySeconds: 0,
        continueOnFailure: false,
      },
    ]);

  const updateAction = (i: number, patch: Partial<ActionDraft>) =>
    setActions((a) => a.map((act, idx) => (idx === i ? { ...act, ...patch } : act)));

  const moveAction = (i: number, dir: -1 | 1) =>
    setActions((a) => {
      const next = [...a];
      const j = i + dir;
      if (j < 0 || j >= next.length) return a;
      const cur = next[i]!;
      next[i] = next[j]!;
      next[j] = cur;
      return next.map((x, idx) => ({ ...x, position: idx + 1 }));
    });

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        eyebrow={
          <Link
            to="/app/automationen"
            className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
            Alle Automationen
          </Link>
        }
        title={isNew ? "Neue Automation" : rule.data?.name || "Automation"}
        description={
          !isNew && rule.data ? (
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {AUTOMATION_STATUS_LABELS[
                  rule.data.status as keyof typeof AUTOMATION_STATUS_LABELS
                ] ?? rule.data.status}
              </Badge>
              <span>
                Entwurf v{rule.data.draftVersion ?? 1}
                {rule.data.activeVersion
                  ? ` · aktiv v${rule.data.activeVersion}`
                  : " · noch nie veröffentlicht"}
              </span>
            </span>
          ) : undefined
        }
        actions={
          <>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              Entwurf speichern
            </Button>
            {!isNew && (
              <Button
                className="h-11"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
              >
                Veröffentlichen &amp; aktivieren
              </Button>
            )}
          </>
        }
      />

      <div className="min-w-0 rounded-xl border border-border bg-muted/40 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">In einem Satz</p>
        <p className="mt-1 min-w-0 break-words text-sm">{summary}</p>
      </div>

      <DetailLayout
        main={
          <>
            <Panel title="Grunddaten" bodyClassName="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rule-name">Name</Label>
                <Input
                  id="rule-name"
                  className="h-11"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Bestellung bezahlt → Rechnung"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-desc">Beschreibung</Label>
                <Textarea
                  id="rule-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </Panel>

            <Panel title="1. Auslöser" bodyClassName="space-y-4">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Art</Label>
                  <Select
                    value={triggerType}
                    onValueChange={(v) => setTriggerType(v as typeof triggerType)}
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="domain_event">Wenn etwas passiert</SelectItem>
                      <SelectItem value="schedule">Regelmäßige Prüfung</SelectItem>
                      <SelectItem value="manual">Nur manuell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {triggerType === "domain_event" && (
                  <div className="space-y-2">
                    <Label>Ereignis</Label>
                    <Select value={eventType} onValueChange={setEventType}>
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_REGISTRY.map((e) => (
                          <SelectItem key={e.type} value={e.type}>
                            {CATEGORY_LABELS[e.category]} · {e.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {triggerType === "schedule" && (
                  <>
                    <div className="space-y-2">
                      <Label>Was wird geprüft</Label>
                      <Select value={scheduleKind} onValueChange={setScheduleKind}>
                        <SelectTrigger className="h-11 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SCHEDULE_KINDS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="every">Prüfung alle (Minuten)</Label>
                      <Input
                        id="every"
                        className="h-11"
                        type="number"
                        min={15}
                        value={everyMinutes}
                        onChange={(e) => setEveryMinutes(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="older">Älter als (Stunden)</Label>
                      <Input
                        id="older"
                        className="h-11"
                        type="number"
                        min={1}
                        value={olderThanHours}
                        onChange={(e) => setOlderThanHours(Number(e.target.value))}
                      />
                    </div>
                  </>
                )}
              </div>
              {event && <p className="text-sm text-muted-foreground">{event.description}</p>}
            </Panel>

            <Panel
              title="2. Bedingungen"
              actions={
                <Select value={mode} onValueChange={(v) => setMode(v as "all" | "any")}>
                  <SelectTrigger className="h-9 w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle müssen zutreffen</SelectItem>
                    <SelectItem value="any">Eine reicht</SelectItem>
                  </SelectContent>
                </Select>
              }
              bodyClassName="space-y-3"
            >
              {conditions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Ohne Bedingungen läuft die Automation bei jedem Auslöser.
                </p>
              )}
              {conditions.map((cond, i) => {
                const field = event?.fields.find((f) => f.path === cond.field);
                const ops = operatorsFor(field?.type ?? "string");
                const noValue = cond.operator === "exists" || cond.operator === "not_exists";
                return (
                  <div key={i} className="grid min-w-0 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <Select
                      value={cond.field}
                      onValueChange={(v) => updateCondition(i, { field: v })}
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue placeholder="Feld" />
                      </SelectTrigger>
                      <SelectContent>
                        {(event?.fields ?? []).map((f) => (
                          <SelectItem key={f.path} value={f.path}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={cond.operator}
                      onValueChange={(v) =>
                        updateCondition(i, { operator: v as Condition["operator"] })
                      }
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ops.map((op) => (
                          <SelectItem key={op} value={op}>
                            {OPERATOR_LABELS[op]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {noValue ? (
                      <div />
                    ) : field?.type === "enum" && field.options?.length ? (
                      <Select
                        value={String(cond.value ?? "")}
                        onValueChange={(v) => updateCondition(i, { value: v })}
                      >
                        <SelectTrigger className="h-11 w-full">
                          <SelectValue placeholder="Wert" />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        className="h-11"
                        value={String(cond.value ?? "")}
                        placeholder={field?.type === "money" ? "Betrag in Cent" : "Wert"}
                        onChange={(e) =>
                          updateCondition(i, {
                            value:
                              field?.type === "number" || field?.type === "money"
                                ? Number(e.target.value)
                                : e.target.value,
                          })
                        }
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConditions((c) => c.filter((_, idx) => idx !== i))}
                    >
                      Entfernen
                    </Button>
                  </div>
                );
              })}
              <Button variant="outline" className="h-11" onClick={addCondition} disabled={!event}>
                Bedingung hinzufügen
              </Button>
            </Panel>

            <Panel title="3. Aktionen" bodyClassName="space-y-4">
              {actions.length === 0 && (
                <p className="text-sm text-muted-foreground">Noch keine Aktion ausgewählt.</p>
              )}
              {actions.map((action, i) => {
                const def = findAction(action.actionType);
                return (
                  <div key={i} className="min-w-0 rounded-lg border border-border p-3">
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="min-w-0 break-words font-medium">
                          {i + 1}. {def?.label ?? action.actionType}
                        </p>
                        <p className="min-w-0 break-words text-xs text-muted-foreground">
                          {def?.description}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant="ghost" onClick={() => moveAction(i, -1)}>
                          ↑
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => moveAction(i, 1)}>
                          ↓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setActions((a) => a.filter((_, idx) => idx !== i))}
                        >
                          Entfernen
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                      {(def?.params ?? []).map((p) => (
                        <div key={p.key} className="space-y-1">
                          <Label className="text-xs">{p.label}</Label>
                          {p.type === "textarea" ? (
                            <Textarea
                              rows={2}
                              value={String(action.config[p.key] ?? "")}
                              onChange={(e) =>
                                updateAction(i, {
                                  config: { ...action.config, [p.key]: e.target.value },
                                })
                              }
                            />
                          ) : p.type === "template" ? (
                            <Select
                              value={String(action.config[p.key] ?? "")}
                              onValueChange={(v) =>
                                updateAction(i, { config: { ...action.config, [p.key]: v } })
                              }
                            >
                              <SelectTrigger className="h-11 w-full">
                                <SelectValue placeholder="Vorlage wählen" />
                              </SelectTrigger>
                              <SelectContent>
                                {(templates.data ?? []).map((t) => (
                                  <SelectItem key={t.key} value={t.key}>
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : p.type === "endpoint" ? (
                            <Select
                              value={String(action.config[p.key] ?? "")}
                              onValueChange={(v) =>
                                updateAction(i, { config: { ...action.config, [p.key]: v } })
                              }
                            >
                              <SelectTrigger className="h-11 w-full">
                                <SelectValue placeholder="Ziel wählen" />
                              </SelectTrigger>
                              <SelectContent>
                                {(endpoints.data ?? []).map((ep) => (
                                  <SelectItem key={ep.id} value={ep.id}>
                                    {ep.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : p.type === "priority" ? (
                            <Select
                              value={String(action.config[p.key] ?? "normal")}
                              onValueChange={(v) =>
                                updateAction(i, { config: { ...action.config, [p.key]: v } })
                              }
                            >
                              <SelectTrigger className="h-11 w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Niedrig</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="high">Hoch</SelectItem>
                                <SelectItem value="urgent">Dringend</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              className="h-11"
                              type={p.type === "number" ? "number" : "text"}
                              placeholder={p.placeholder}
                              value={String(action.config[p.key] ?? "")}
                              onChange={(e) =>
                                updateAction(i, {
                                  config: {
                                    ...action.config,
                                    [p.key]:
                                      p.type === "number" ? Number(e.target.value) : e.target.value,
                                  },
                                })
                              }
                            />
                          )}
                          {p.help && <p className="text-xs text-muted-foreground">{p.help}</p>}
                        </div>
                      ))}
                      <div className="space-y-1">
                        <Label className="text-xs">Verzögerung (Sekunden)</Label>
                        <Input
                          className="h-11"
                          type="number"
                          min={0}
                          value={action.delaySeconds}
                          onChange={(e) =>
                            updateAction(i, { delaySeconds: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <Switch
                          id={`cont-${i}`}
                          checked={action.continueOnFailure}
                          onCheckedChange={(v) => updateAction(i, { continueOnFailure: v })}
                        />
                        <Label htmlFor={`cont-${i}`} className="text-xs">
                          Bei Fehler trotzdem weitermachen
                        </Label>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="space-y-2">
                <Label className="text-xs">Aktion hinzufügen</Label>
                <Select value="" onValueChange={addAction}>
                  <SelectTrigger className="h-11 w-full sm:w-80">
                    <SelectValue placeholder="Aktion auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_REGISTRY.map((a) => (
                      <SelectItem key={a.type} value={a.type}>
                        {a.category} · {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Panel>
          </>
        }
        aside={
          <>
            <Panel title="Sicherheitsgrenzen" bodyClassName="space-y-4">
              <div className="flex items-center gap-2">
                <Switch id="stop" checked={stopOnError} onCheckedChange={setStopOnError} />
                <Label htmlFor="stop" className="text-sm">
                  Bei Fehler abbrechen
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mph" className="text-sm">
                  Maximal pro Stunde
                </Label>
                <Input
                  id="mph"
                  className="h-11"
                  type="number"
                  min={1}
                  placeholder="unbegrenzt"
                  value={maxPerHour}
                  onChange={(e) => setMaxPerHour(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mpe" className="text-sm">
                  Maximal pro Datensatz
                </Label>
                <Input
                  id="mpe"
                  className="h-11"
                  type="number"
                  min={1}
                  placeholder="unbegrenzt"
                  value={maxPerEntity}
                  onChange={(e) => setMaxPerEntity(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Häufen sich Fehler, pausiert das System die Automation automatisch und meldet es im
                Überblick.
              </p>
            </Panel>

            {!isNew && (
              <Panel title="Testlauf" bodyClassName="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Prüft Bedingungen und geplante Aktionen — ohne etwas auszuführen.
                </p>
                <Textarea
                  rows={8}
                  className="font-mono text-xs"
                  value={payloadText}
                  onChange={(e) => setPayloadText(e.target.value)}
                />
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={dryRunMutation.isPending}
                  onClick={() => {
                    try {
                      dryRunMutation.mutate(JSON.parse(payloadText) as Record<string, unknown>);
                    } catch {
                      toast.error("Die Testdaten sind kein gültiges JSON.");
                    }
                  }}
                >
                  Testlauf starten
                </Button>
                {dryResult && (
                  <div className="min-w-0 space-y-2 rounded-md border border-border p-3 text-sm">
                    <p className={dryResult.matched ? "text-primary" : "text-muted-foreground"}>
                      {dryResult.matched
                        ? "Automation würde laufen."
                        : "Bedingungen nicht erfüllt."}
                    </p>
                    <ul className="space-y-1 text-xs">
                      {dryResult.trace.map((t, i) => (
                        <li
                          key={i}
                          className={
                            "min-w-0 break-words " +
                            (t.passed ? "text-muted-foreground" : "text-destructive")
                          }
                        >
                          {t.field} {t.operator} {String(t.expected ?? "")} — ist{" "}
                          {String(t.actual ?? "–")}
                        </li>
                      ))}
                    </ul>
                    <ul className="space-y-1 text-xs">
                      {dryResult.actions.map((a) => (
                        <li key={a.position} className="min-w-0 break-words">
                          {a.position}. {findAction(a.actionType)?.label ?? a.actionType}{" "}
                          {a.wouldRun ? "→ würde ausgeführt" : "→ übersprungen"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>
            )}

            {!isNew && (
              <Panel title="Letzte Läufe" bodyClassName="space-y-2">
                {(executions.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Noch keine Läufe.</p>
                )}
                {(executions.data ?? []).map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString("de-DE")}
                    </span>
                    <Badge variant={e.status === "failed" ? "destructive" : "secondary"}>
                      {EXECUTION_STATUS_LABELS[e.status as keyof typeof EXECUTION_STATUS_LABELS] ??
                        e.status}
                    </Badge>
                  </div>
                ))}
              </Panel>
            )}
          </>
        }
      />

      <StickyActionBar className="lg:hidden">
        <Button
          variant="outline"
          className="h-11 flex-1"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          Entwurf speichern
        </Button>
        {!isNew && (
          <Button
            className="h-11 flex-1"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
          >
            Veröffentlichen
          </Button>
        )}
      </StickyActionBar>
    </div>
  );
}
