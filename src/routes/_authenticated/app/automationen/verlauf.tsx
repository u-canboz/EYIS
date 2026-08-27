import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import {
  listExecutionsFn,
  getExecutionFn,
  retryExecutionFn,
} from "@/lib/commerce/automation/automation.functions";
import {
  EXECUTION_STATUS_LABELS,
  ERROR_CODE_LABELS,
} from "@/lib/commerce/automation/automation.types";
import { actionLabel } from "@/lib/commerce/automation/action-registry";
import { eventLabel } from "@/lib/commerce/automation/event-registry";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/shell/PageHeader";
import { ScrollTabs } from "@/components/shell/DetailLayout";
import { EmptyState } from "@/components/data/States";

type Search = { executionId?: string | undefined; status?: string | undefined };

export const Route = createFileRoute("/_authenticated/app/automationen/verlauf")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    executionId: typeof search["executionId"] === "string" ? search["executionId"] : undefined,
    status: typeof search["status"] === "string" ? search["status"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Automations-Verlauf – Commerce OS" },
      {
        name: "description",
        content:
          "Jeder Automationslauf mit Auslöser, Bedingungen, Aktionen, Fehlern und Wiederholung — vollständig nachvollziehbar.",
      },
      { property: "og:title", content: "Automations-Verlauf – Commerce OS" },
      {
        property: "og:description",
        content: "Läufe prüfen, Fehler verstehen und gezielt wiederholen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExecutionHistory,
});

const FILTERS = [
  { value: "", label: "Alle" },
  { value: "completed", label: "Erfolgreich" },
  { value: "failed", label: "Fehlgeschlagen" },
  { value: "queued", label: "Wartend" },
];

function ExecutionHistory() {
  const { organizationId, shopId } = useActiveWorkspace();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const enabled = !!organizationId && !!shopId;

  const fetchList = useServerFn(listExecutionsFn);
  const fetchOne = useServerFn(getExecutionFn);
  const retry = useServerFn(retryExecutionFn);

  const executions = useQuery({
    queryKey: ["automation-executions", organizationId, shopId, search.status ?? "all"],
    enabled,
    queryFn: () =>
      fetchList({
        data: {
          organizationId,
          shopId,
          status: search.status ? [search.status] : null,
          limit: 100,
        },
      }),
  });

  const detail = useQuery({
    queryKey: ["automation-execution", organizationId, search.executionId],
    enabled: enabled && !!search.executionId,
    queryFn: () => fetchOne({ data: { organizationId, executionId: search.executionId! } }),
  });

  const retryMutation = useMutation({
    mutationFn: (executionId: string) => retry({ data: { organizationId, executionId } }),
    onSuccess: () => {
      toast.success("Lauf wird wiederholt.");
      void qc.invalidateQueries({ queryKey: ["automation-executions"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
            Automationen
          </Link>
        }
        title="Verlauf"
        description="Jeder Lauf mit Auslöser, Ergebnis und Fehlerursache."
      />

      <ScrollTabs>
        {FILTERS.map((f) => (
          <Button
            key={f.value || "all"}
            size="sm"
            className="min-h-11"
            variant={(search.status ?? "") === f.value ? "default" : "outline"}
            onClick={() =>
              void navigate({ search: (s: Search) => ({ ...s, status: f.value || undefined }) })
            }
          >
            {f.label}
          </Button>
        ))}
      </ScrollTabs>

      {executions.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (executions.data ?? []).length === 0 ? (
        <EmptyState title="Noch keine Läufe aufgezeichnet." />
      ) : (
        <ul className="min-w-0 divide-y divide-border rounded-xl border border-border bg-card text-sm">
          {(executions.data ?? []).map((e) => (
            <li
              key={e.id}
              className="grid min-w-0 grid-cols-1 gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{e.ruleName}</p>
                <p className="min-w-0 break-words text-muted-foreground">
                  {e.eventType ? eventLabel(e.eventType) : "Zeitgesteuert"} ·{" "}
                  {new Date(e.createdAt).toLocaleString("de-DE")}
                  {e.durationMs != null ? ` · ${e.durationMs} ms` : ""}
                </p>
                {e.errorCode && (
                  <p className="min-w-0 break-words text-destructive">
                    {ERROR_CODE_LABELS[e.errorCode] ?? e.errorCode}
                    {e.error ? `: ${e.error}` : ""}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={e.status === "failed" ? "destructive" : "secondary"}>
                  {EXECUTION_STATUS_LABELS[e.status as keyof typeof EXECUTION_STATUS_LABELS] ??
                    e.status}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void navigate({ search: (s: Search) => ({ ...s, executionId: e.id }) })
                  }
                >
                  Details
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={!!search.executionId}
        onOpenChange={(open) => {
          if (!open) void navigate({ search: (s: Search) => ({ ...s, executionId: undefined }) });
        }}
      >
        <SheetContent className="w-full max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Lauf-Details</SheetTitle>
            <SheetDescription>
              Vollständige Nachvollziehbarkeit: Auslöser, Daten und jede einzelne Aktion.
            </SheetDescription>
          </SheetHeader>
          {detail.isLoading ? (
            <Skeleton className="mt-6 h-64 w-full" />
          ) : detail.data ? (
            <div className="mt-6 min-w-0 space-y-5 px-4 pb-6 text-sm">
              <div className="min-w-0">
                <p className="min-w-0 break-words font-medium">{detail.data.ruleName}</p>
                <p className="text-muted-foreground">
                  Version {detail.data.version} ·{" "}
                  {EXECUTION_STATUS_LABELS[
                    detail.data.status as keyof typeof EXECUTION_STATUS_LABELS
                  ] ?? detail.data.status}
                </p>
              </div>
              {detail.data.errorCode && (
                <div className="min-w-0 break-words rounded-md border border-destructive/40 p-3 text-destructive">
                  {ERROR_CODE_LABELS[detail.data.errorCode] ?? detail.data.errorCode}
                  {detail.data.error ? `: ${detail.data.error}` : ""}
                </div>
              )}
              <div className="min-w-0">
                <p className="mb-2 font-medium">Aktionen</p>
                <ul className="space-y-2">
                  {detail.data.actions.map((a) => (
                    <li key={a.id} className="min-w-0 rounded-md border border-border p-2">
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          {a.position}. {actionLabel(a.actionType)}
                        </span>
                        <Badge
                          variant={a.status === "failed" ? "destructive" : "secondary"}
                          className="shrink-0"
                        >
                          {a.status}
                        </Badge>
                      </div>
                      {a.errorMessage && (
                        <p className="mt-1 min-w-0 break-words text-xs text-destructive">
                          {a.errorMessage}
                        </p>
                      )}
                      {a.skippedReason && (
                        <p className="mt-1 min-w-0 break-words text-xs text-muted-foreground">
                          {a.skippedReason}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0">
                <p className="mb-2 font-medium">Ausgangsdaten</p>
                <pre className="max-h-64 min-w-0 overflow-auto rounded-md bg-muted p-3 text-xs break-words">
                  {JSON.stringify(detail.data.context, null, 2)}
                </pre>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={retryMutation.isPending}
                onClick={() => retryMutation.mutate(detail.data!.id)}
              >
                Lauf wiederholen
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
