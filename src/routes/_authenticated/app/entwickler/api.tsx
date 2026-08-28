import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AUTH_LABEL,
  STORE_API_BASE_PATH,
  STORE_API_GROUPS,
  STORE_ENDPOINT_COUNT,
  STORE_ERROR_CODES,
  STORE_HEADERS,
  STORE_RATE_LIMITS,
} from "@/lib/commerce/store/api-catalog";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/shell/DetailLayout";

export const Route = createFileRoute("/_authenticated/app/entwickler/api")({
  head: () => ({
    meta: [
      { title: "Store-API-Referenz – EYIS" },
      {
        name: "description",
        content:
          "Alle Endpunkte der öffentlichen Store API v1 mit Auth-Stufe, Ein- und Ausgabe, Fehlercodes und SDK-Beispiel.",
      },
      { property: "og:title", content: "Store-API-Referenz – EYIS" },
      {
        property: "og:description",
        content: "Endpunkte, Header, Fehlermodell und Rate-Limits der öffentlichen Store API.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StoreApiReference,
});

function StoreApiReference() {
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        eyebrow={
          <Link to="/app/entwickler" className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground hover:underline">
            ← Entwickler
          </Link>
        }
        title="Store-API-Referenz"
        description={
          <>
            {STORE_ENDPOINT_COUNT} Endpunkte unter{" "}
            <code className="font-mono">{STORE_API_BASE_PATH}</code>. Der Publishable Key
            identifiziert nur den Shop und ist <strong>kein Geheimnis</strong> – er darf im
            Browser-Bundle stehen. Jeder Zugriff auf Warenkorb, Bestellung, Konto oder Dokument
            braucht zusätzlich einen echten Zugriffsnachweis.
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link to="/app/entwickler" className="text-primary hover:underline">
              Keys verwalten
            </Link>
            <Link to="/app/entwickler/protokoll" className="text-primary hover:underline">
              Anfrage-Protokoll
            </Link>
            <Link to="/app/automationen/webhooks" className="text-primary hover:underline">
              Ausgehende Webhooks
            </Link>
          </div>
        }
      />

      <div className="grid min-w-0 gap-5 lg:grid-cols-3">
        <Panel title="Header">
          <div className="min-w-0 space-y-3 text-sm">
            {STORE_HEADERS.map((h) => (
              <div key={h.name} className="min-w-0">
                <code className="font-mono text-xs">{h.name}</code>
                <p className="break-words text-xs text-muted-foreground">
                  {h.required} · {h.purpose}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Fehlermodell">
          <div className="min-w-0 space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">
              Jede Fehlerantwort hat die Form{" "}
              <code className="font-mono">{"{ code, message, fieldErrors?, requestId }"}</code>.
            </p>
            {STORE_ERROR_CODES.map((e) => (
              <div key={e.code} className="flex min-w-0 gap-2 text-xs">
                <code className="w-44 shrink-0 font-mono">{e.code}</code>
                <span className="w-8 shrink-0 text-muted-foreground">{e.status}</span>
                <span className="min-w-0 break-words text-muted-foreground">{e.meaning}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Rate-Limits">
          <div className="min-w-0 space-y-1 text-xs">
            {STORE_RATE_LIMITS.map((r) => (
              <div key={r.profile} className="flex min-w-0 justify-between gap-2">
                <code className="min-w-0 truncate font-mono">{r.profile}</code>
                <span className="shrink-0 text-muted-foreground">{r.limit}</span>
              </div>
            ))}
            <p className="pt-2 text-muted-foreground">
              Gezählt wird pro Key und pro anonymisiertem Besucher-Hash.
            </p>
          </div>
        </Panel>
      </div>

      {STORE_API_GROUPS.map((group) => (
        <section key={group.key} className="min-w-0 space-y-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold">{group.title}</h2>
            <p className="text-sm text-muted-foreground">{group.description}</p>
          </div>
          <div className="min-w-0 space-y-2">
            {group.endpoints.map((e) => (
              <Panel key={`${e.method} ${e.path}`}>
                <div className="min-w-0 space-y-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-mono">
                      {e.method}
                    </Badge>
                    <code className="min-w-0 break-words font-mono text-sm">
                      {STORE_API_BASE_PATH}
                      {e.path}
                    </code>
                    <Badge variant="outline">{AUTH_LABEL[e.auth]}</Badge>
                    <span className="text-xs text-muted-foreground">{e.profile}</span>
                  </div>
                  <p className="text-sm">{e.summary}</p>
                  <dl className="grid min-w-0 gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                    <div className="min-w-0">
                      <dt className="font-medium text-foreground">Eingabe</dt>
                      <dd className="break-words font-mono">{e.input ?? "—"}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="font-medium text-foreground">Ausgabe</dt>
                      <dd className="break-words font-mono">{e.output}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="font-medium text-foreground">Fehler</dt>
                      <dd className="break-words font-mono">{e.errors.join(", ")}</dd>
                    </div>
                  </dl>
                  <code className="block min-w-0 break-all rounded-md bg-muted p-2 font-mono text-xs">
                    {e.sdk}
                  </code>
                </div>
              </Panel>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
