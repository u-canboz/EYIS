import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getCommunicationFn,
  resendCommunicationFn,
} from "@/lib/commerce/communications/communication.functions";
import { DELIVERY_LABELS, STATUS_LABELS } from "@/lib/commerce/communications/communication.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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

  if (detail.isLoading || !detail.data) return <Skeleton className="h-96 w-full" />;
  const c = detail.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/app/kommunikation/verlauf"
            className="text-xs text-muted-foreground hover:underline"
          >
            ← Versandprotokoll
          </Link>
          <h1 className="font-display text-2xl font-semibold">{c.subject}</h1>
          <p className="text-sm text-muted-foreground">
            {c.recipient} · {new Date(c.createdAt).toLocaleString("de-DE")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={c.status === "failed" ? "destructive" : "secondary"}>
            {STATUS_LABELS[c.status] ?? c.status}
          </Badge>
          {c.deliveryStatus && <Badge variant="outline">{DELIVERY_LABELS[c.deliveryStatus]}</Badge>}
          <Button
            size="sm"
            variant="outline"
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
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Vorlage",
            value: `${c.templateKey}${c.templateVersion ? ` v${c.templateVersion}` : ""}`,
          },
          { label: "Anbieter", value: c.provider ?? "–" },
          { label: "Absender", value: c.senderAddress ?? c.senderName ?? "–" },
          { label: "Auslöser", value: c.sourceEventType ?? (c.isTestSend ? "Testversand" : "–") },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <p className="mt-1 truncate text-sm">{item.value}</p>
          </div>
        ))}
      </section>

      {c.lastError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {c.lastError}
        </p>
      )}
      {c.resendOf && (
        <p className="rounded-lg border p-3 text-sm text-muted-foreground">
          Diese Nachricht wurde als erneuter Versand erzeugt.{" "}
          <Link
            to="/app/kommunikation/verlauf/$communicationId"
            params={{ communicationId: c.resendOf }}
            className="underline"
          >
            Ursprüngliche Nachricht
          </Link>
        </p>
      )}

      <section className="space-y-2">
        <p className="text-sm font-medium">Gesendeter Inhalt (Snapshot)</p>
        <div className="overflow-hidden rounded-lg border">
          <iframe title="Snapshot" srcDoc={c.html} className="h-[600px] w-full bg-white" />
        </div>
      </section>

      <section className="rounded-lg border">
        <p className="border-b px-4 py-3 text-sm font-medium">Sendeversuche</p>
        {!c.attempts.length ? (
          <p className="p-4 text-sm text-muted-foreground">Noch kein Versuch protokolliert.</p>
        ) : (
          <ul className="divide-y">
            {c.attempts.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  Versuch {a.attemptNumber} · {a.provider} ·{" "}
                  {new Date(a.startedAt).toLocaleString("de-DE")}
                </span>
                <span className={a.errorCode ? "text-destructive" : "text-muted-foreground"}>
                  {a.errorCode ? `${a.errorCode}: ${a.errorMessage}` : DELIVERY_LABELS[a.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border">
        <p className="border-b px-4 py-3 text-sm font-medium">Anbieterereignisse</p>
        {!c.providerEvents.length ? (
          <p className="p-4 text-sm text-muted-foreground">Keine Rückmeldungen erhalten.</p>
        ) : (
          <ul className="divide-y">
            {c.providerEvents.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  {e.eventType} · {new Date(e.receivedAt).toLocaleString("de-DE")}
                </span>
                <span className="text-muted-foreground">
                  {e.signatureVerified ? "Signatur geprüft" : "ohne Signatur"} ·{" "}
                  {e.processingStatus}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
