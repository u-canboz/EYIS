import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import {
  getCommunicationFn,
  resendCommunicationFn,
} from "@/lib/commerce/communications/communication.functions";
import { DELIVERY_LABELS, STATUS_LABELS } from "@/lib/commerce/communications/communication.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shell/PageHeader";
import { DetailLayout, Panel, DataRow } from "@/components/shell/DetailLayout";

export const Route = createFileRoute("/_authenticated/app/kommunikation/verlauf/$communicationId")({
  head: () => ({
    meta: [
      { title: "Nachricht – Commerce OS" },
      {
        name: "description",
        content: "Snapshot, Zustellstatus, Sendeversuche und Anbieterereignisse einer Nachricht.",
      },
      { property: "og:title", content: "Nachricht – Commerce OS" },
      { property: "og:description", content: "Vollständige Nachvollziehbarkeit je Nachricht." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunicationDetailPage,
});

function CommunicationDetailPage() {
  const { communicationId } = Route.useParams();
  const { organizationId } = useActiveWorkspace();
  const fetchDetail = useServerFn(getCommunicationFn);
  const resend = useServerFn(resendCommunicationFn);
  const [busy, setBusy] = useState(false);

  const detail = useQuery({
    queryKey: ["communication", organizationId, communicationId],
    enabled: !!organizationId,
    queryFn: () => fetchDetail({ data: { organizationId, communicationId } }),
  });

  if (detail.isLoading || !detail.data) {
    return (
      <div className="min-w-0 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  const c = detail.data;

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        eyebrow={
          <Link
            to="/app/kommunikation/verlauf"
            className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
            Versandprotokoll
          </Link>
        }
        title={c.subject}
        description={`${c.recipient} · ${new Date(c.createdAt).toLocaleString("de-DE")}`}
        actions={
          <Button
            size="sm"
            variant="outline"
            className="h-11"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await resend({ data: { organizationId, communicationId } });
                toast.success("Neue Nachricht wurde erzeugt und versendet.");
                await detail.refetch();
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Erneutes Senden fehlgeschlagen.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Erneut senden
          </Button>
        }
      />

      <div className="flex min-w-0 flex-wrap gap-2">
        <Badge variant={c.status === "failed" ? "destructive" : "secondary"}>
          {STATUS_LABELS[c.status] ?? c.status}
        </Badge>
        {c.deliveryStatus && <Badge variant="outline">{DELIVERY_LABELS[c.deliveryStatus]}</Badge>}
      </div>

      <DetailLayout
        main={
          <>
            <Panel title="Gesendeter Inhalt (Snapshot)" bodyClassName="p-0">
              <div className="min-w-0 overflow-hidden rounded-b-xl">
                <iframe title="Snapshot" srcDoc={c.html} className="h-[600px] w-full bg-white" />
              </div>
            </Panel>

            <Panel title="Sendeversuche">
              {!c.attempts.length ? (
                <p className="text-sm text-muted-foreground">Noch kein Versuch protokolliert.</p>
              ) : (
                <ul className="min-w-0 space-y-1.5 text-sm">
                  {c.attempts.map((a) => (
                    <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <span className="min-w-0 break-words">
                        Versuch {a.attemptNumber} · {a.provider} ·{" "}
                        {new Date(a.startedAt).toLocaleString("de-DE")}
                      </span>
                      <span
                        className={
                          a.errorCode
                            ? "shrink-0 break-words text-right text-destructive"
                            : "shrink-0 text-right text-muted-foreground"
                        }
                      >
                        {a.errorCode ? `${a.errorCode}: ${a.errorMessage}` : DELIVERY_LABELS[a.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Anbieterereignisse">
              {!c.providerEvents.length ? (
                <p className="text-sm text-muted-foreground">Keine Rückmeldungen erhalten.</p>
              ) : (
                <ul className="min-w-0 space-y-1.5 text-sm">
                  {c.providerEvents.map((e) => (
                    <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <span className="min-w-0 break-words">
                        {e.eventType} · {new Date(e.receivedAt).toLocaleString("de-DE")}
                      </span>
                      <span className="shrink-0 text-right text-muted-foreground">
                        {e.signatureVerified ? "Signatur geprüft" : "ohne Signatur"} ·{" "}
                        {e.processingStatus}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        }
        aside={
          <>
            <Panel title="Details">
              <dl className="min-w-0">
                <DataRow
                  label="Vorlage"
                  value={`${c.templateKey}${c.templateVersion ? ` v${c.templateVersion}` : ""}`}
                />
                <DataRow label="Anbieter" value={c.provider ?? "–"} />
                <DataRow label="Absender" value={c.senderAddress ?? c.senderName ?? "–"} />
                <DataRow
                  label="Auslöser"
                  value={c.sourceEventType ?? (c.isTestSend ? "Testversand" : "–")}
                />
              </dl>
            </Panel>

            {c.lastError && (
              <Panel title="Fehler" className="border-destructive/30 bg-destructive/5">
                <p className="min-w-0 break-words text-sm">{c.lastError}</p>
              </Panel>
            )}

            {c.resendOf && (
              <Panel title="Herkunft">
                <p className="text-sm text-muted-foreground">
                  Diese Nachricht wurde als erneuter Versand erzeugt.{" "}
                  <Link
                    to="/app/kommunikation/verlauf/$communicationId"
                    params={{ communicationId: c.resendOf }}
                    className="underline"
                  >
                    Ursprüngliche Nachricht
                  </Link>
                </p>
              </Panel>
            )}
          </>
        }
      />
    </div>
  );
}
