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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app/entwickler/api")({
  head: () => ({
    meta: [
      { title: "Store-API-Referenz – Commerce OS" },
      {
        name: "description",
        content:
          "Alle Endpunkte der öffentlichen Store API v1 mit Auth-Stufe, Ein- und Ausgabe, Fehlercodes und SDK-Beispiel.",
      },
      { property: "og:title", content: "Store-API-Referenz – Commerce OS" },
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
    <div className="space-y-8">
      <header className="space-y-2">
        <Link to="/app/entwickler" className="text-sm text-muted-foreground hover:underline">
          ← Entwickler
        </Link>
        <h1 className="font-display text-2xl font-semibold">Store-API-Referenz</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {STORE_ENDPOINT_COUNT} Endpunkte unter{" "}
          <code className="font-mono">{STORE_API_BASE_PATH}</code>. Der Publishable Key
          identifiziert nur den Shop und ist <strong>kein Geheimnis</strong> – er darf im
          Browser-Bundle stehen. Jeder Zugriff auf Warenkorb, Bestellung, Konto oder Dokument
          braucht zusätzlich einen echten Zugriffsnachweis.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
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
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Header</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {STORE_HEADERS.map((h) => (
              <div key={h.name}>
                <code className="font-mono text-xs">{h.name}</code>
                <p className="text-xs text-muted-foreground">
                  {h.required} · {h.purpose}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fehlermodell</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">
              Jede Fehlerantwort hat die Form{" "}
              <code className="font-mono">{"{ code, message, fieldErrors?, requestId }"}</code>.
            </p>
            {STORE_ERROR_CODES.map((e) => (
              <div key={e.code} className="flex gap-2 text-xs">
                <code className="w-44 shrink-0 font-mono">{e.code}</code>
                <span className="w-8 shrink-0 text-muted-foreground">{e.status}</span>
                <span className="text-muted-foreground">{e.meaning}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rate-Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {STORE_RATE_LIMITS.map((r) => (
              <div key={r.profile} className="flex justify-between">
                <code className="font-mono">{r.profile}</code>
                <span className="text-muted-foreground">{r.limit}</span>
              </div>
            ))}
            <p className="pt-2 text-muted-foreground">
              Gezählt wird pro Key und pro anonymisiertem Besucher-Hash.
            </p>
          </CardContent>
        </Card>
      </div>

      {STORE_API_GROUPS.map((group) => (
        <section key={group.key} className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-semibold">{group.title}</h2>
            <p className="text-sm text-muted-foreground">{group.description}</p>
          </div>
          <div className="space-y-2">
            {group.endpoints.map((e) => (
              <Card key={`${e.method} ${e.path}`}>
                <CardContent className="space-y-2 pt-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-mono">
                      {e.method}
                    </Badge>
                    <code className="font-mono text-sm">
                      {STORE_API_BASE_PATH}
                      {e.path}
                    </code>
                    <Badge variant="outline">{AUTH_LABEL[e.auth]}</Badge>
                    <span className="text-xs text-muted-foreground">{e.profile}</span>
                  </div>
                  <p className="text-sm">{e.summary}</p>
                  <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                    <div>
                      <dt className="font-medium text-foreground">Eingabe</dt>
                      <dd className="font-mono">{e.input ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Ausgabe</dt>
                      <dd className="font-mono">{e.output}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Fehler</dt>
                      <dd className="font-mono">{e.errors.join(", ")}</dd>
                    </div>
                  </dl>
                  <code className="block break-all rounded-md bg-muted p-2 font-mono text-xs">
                    {e.sdk}
                  </code>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
