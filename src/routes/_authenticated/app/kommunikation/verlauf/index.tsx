import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCommunicationsFn } from "@/lib/commerce/communications/communication.functions";
import { DELIVERY_LABELS, STATUS_LABELS } from "@/lib/commerce/communications/communication.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/kommunikation/verlauf/")({
  head: () => ({
    meta: [
      { title: "Versandprotokoll – Commerce OS" },
      {
        name: "description",
        content:
          "Alle erzeugten E-Mails mit Empfänger, Status, Zustellinformationen und unveränderbarem Snapshot.",
      },
      { property: "og:title", content: "Versandprotokoll – Commerce OS" },
      { property: "og:description", content: "Nachvollziehen, was wann an wen gesendet wurde." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LogPage,
});

const FILTERS = [
  { key: "all", label: "Alle", status: null },
  { key: "queued", label: "Warteschlange", status: "queued" },
  { key: "sent", label: "Gesendet", status: "sent" },
  { key: "delivered", label: "Zugestellt", status: "delivered" },
  { key: "failed", label: "Fehlgeschlagen", status: "failed" },
  { key: "suppressed", label: "Unterdrückt", status: "suppressed" },
] as const;

function LogPage() {
  const { organizationId, shopId } = useActiveWorkspace();
  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const fetchLogs = useServerFn(listCommunicationsFn);

  const status = FILTERS.find((f) => f.key === tab)?.status ?? null;
  const logs = useQuery({
    queryKey: ["communications", organizationId, shopId, tab, search],
    enabled: !!organizationId && !!shopId,
    queryFn: () =>
      fetchLogs({ data: { organizationId, shopId, status, search: search || null, limit: 200 } }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Versandprotokoll</h1>
        <p className="text-sm text-muted-foreground">
          Jede Nachricht wird als unveränderbarer Snapshot gespeichert – inklusive Versuchen und
          Anbieterrückmeldungen.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setTab(f.key)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              tab === f.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
        <Input
          className="ml-auto h-8 w-56"
          placeholder="Empfänger suchen"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {logs.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !logs.data?.length ? (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground">
          Keine Nachrichten in dieser Ansicht.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {logs.data.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link
                  to="/app/kommunikation/verlauf/$communicationId"
                  params={{ communicationId: l.id }}
                  className="font-medium hover:underline"
                >
                  {l.subject || l.templateKey}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {l.recipient} · {new Date(l.createdAt).toLocaleString("de-DE")}
                  {l.orderNumber ? ` · ${l.orderNumber}` : ""}
                  {l.sourceEventType ? ` · ${l.sourceEventType}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {l.isTestSend && <Badge variant="outline">Test</Badge>}
                {l.deliveryStatus && (
                  <Badge variant="outline">{DELIVERY_LABELS[l.deliveryStatus]}</Badge>
                )}
                <Badge variant={l.status === "failed" ? "destructive" : "secondary"}>
                  {STATUS_LABELS[l.status] ?? l.status}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
