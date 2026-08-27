import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCommunicationsFn } from "@/lib/commerce/communications/communication.functions";
import { DELIVERY_LABELS, STATUS_LABELS } from "@/lib/commerce/communications/communication.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/PageHeader";
import { ScrollTabs } from "@/components/shell/DetailLayout";
import { RecordCard, RecordCardList } from "@/components/data/RecordCard";
import { TableScroll } from "@/components/data/TableScroll";
import { EmptyState, ListSkeleton } from "@/components/data/States";

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
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Versandprotokoll"
        description="Jede Nachricht wird als unveränderbarer Snapshot gespeichert – inklusive Versuchen und Anbieterrückmeldungen."
      />

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <ScrollTabs className="sm:flex-1">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={tab === f.key ? "default" : "outline"}
              className="min-h-11 shrink-0 rounded-full"
              onClick={() => setTab(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </ScrollTabs>
        <Input
          className="h-11 w-full sm:w-64"
          placeholder="Empfänger suchen"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {logs.isLoading ? (
        <ListSkeleton />
      ) : !logs.data?.length ? (
        <EmptyState title="Keine Nachrichten" description="Für diese Ansicht liegen keine Nachrichten vor." />
      ) : (
        <>
          <RecordCardList>
            {logs.data.map((l) => (
              <Link
                key={l.id}
                to="/app/kommunikation/verlauf/$communicationId"
                params={{ communicationId: l.id }}
                className="min-w-0"
              >
                <RecordCard
                  interactive
                  title={l.subject || l.templateKey}
                  subtitle={`${l.recipient} · ${new Date(l.createdAt).toLocaleString("de-DE")}`}
                  badges={
                    <>
                      {l.isTestSend && <Badge variant="outline">Test</Badge>}
                      {l.deliveryStatus && (
                        <Badge variant="outline">{DELIVERY_LABELS[l.deliveryStatus]}</Badge>
                      )}
                      <Badge variant={l.status === "failed" ? "destructive" : "secondary"}>
                        {STATUS_LABELS[l.status] ?? l.status}
                      </Badge>
                    </>
                  }
                  fields={[
                    ...(l.orderNumber ? [{ label: "Bestellung", value: l.orderNumber }] : []),
                    ...(l.sourceEventType ? [{ label: "Ereignis", value: l.sourceEventType }] : []),
                  ]}
                />
              </Link>
            ))}
          </RecordCardList>

          <TableScroll desktopOnly>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Betreff</th>
                  <th className="p-3 font-medium">Empfänger</th>
                  <th className="p-3 font-medium">Datum</th>
                  <th className="p-3 font-medium">Zustellung</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.data.map((l) => (
                  <tr key={l.id} className="border-t border-border hover:bg-muted/40">
                    <td className="max-w-[20rem] p-3">
                      <Link
                        to="/app/kommunikation/verlauf/$communicationId"
                        params={{ communicationId: l.id }}
                        className="block truncate font-medium hover:underline"
                      >
                        {l.subject || l.templateKey}
                      </Link>
                      {(l.orderNumber || l.sourceEventType) && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {[l.orderNumber, l.sourceEventType].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[14rem] truncate p-3">{l.recipient}</td>
                    <td className="p-3 whitespace-nowrap tabular-nums">
                      {new Date(l.createdAt).toLocaleString("de-DE")}
                    </td>
                    <td className="p-3">
                      <span className={cn("flex flex-wrap items-center gap-1.5")}>
                        {l.isTestSend && <Badge variant="outline">Test</Badge>}
                        {l.deliveryStatus && (
                          <Badge variant="outline">{DELIVERY_LABELS[l.deliveryStatus]}</Badge>
                        )}
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge variant={l.status === "failed" ? "destructive" : "secondary"}>
                        {STATUS_LABELS[l.status] ?? l.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </>
      )}
    </div>
  );
}
