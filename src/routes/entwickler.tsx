import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Github, Terminal } from "lucide-react";
import { CodeBlock } from "@/components/site/CodeBlock";
import { SITE } from "@/lib/site-meta";

export const Route = createFileRoute("/entwickler")({
  head: () => ({
    meta: [
      { title: "Entwickler & Agenten-Setup – Commerce OS" },
      {
        name: "description",
        content:
          "Installation, Agenten-Regeln, Store API v1 und SDK-Beispiele für Commerce OS: klonen, bun run dev, verify und erste Storefront in Minuten.",
      },
      { property: "og:title", content: "Entwickler & Agenten-Setup – Commerce OS" },
      {
        property: "og:description",
        content:
          "Installation, Agenten-Regeln, Store API v1 und SDK-Beispiele für Commerce OS.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeveloperPage,
});

const INSTALL = `git clone ${SITE.repoUrl}.git
cd commerce-os
bun install
bun run dev        # http://localhost:8080`;

const VERIFY = `bun run typecheck            # TypeScript ohne Emit
bun run test                 # Engine- und Grenz-Tests
bun run generate:manifests   # nach Doku-/Routenänderungen
bun run verify               # Pflichtlauf vor jedem Abschluss`;

const AGENT_BOOTSTRAP = `# .cursorrules / AGENTS.md deines Projekts
Arbeite ausschließlich nach den Regeln in AGENTS.md dieses Repositories.

Reihenfolge beim Einstieg:
1. AGENTS.md
2. docs/agent/START_HERE.md
3. docs/agent/OPERATING_MODES.md   -> Betriebsart A, B oder C bestimmen
4. docs/agent/ARCHITECTURE_MAP.md
5. docs/agent/SECURITY_BOUNDARIES.md

Nicht verhandelbar:
- Mandantentrennung über organization_id / shop_id in jeder Abfrage
- Neue Tabelle: CREATE TABLE -> GRANT -> ENABLE RLS -> CREATE POLICY
- Storefronts nur über @/lib/store-sdk (kein Supabase-Import)
- Server rechnet Preise, Steuern, Bestände und Summen
- Keine Seeds, QA-Läufe oder echten Zahlungen gegen Production
- Fertig ist erst, was "bun run verify" grün bestätigt`;

const API_CURL = `curl https://deine-domain.tld/api/public/store/v1/catalog/products \\
  -H "Authorization: Bearer $STORE_PUBLISHABLE_KEY" \\
  -H "Accept: application/json"`;

const SDK_REACT = `import { StoreProvider, useCatalog } from "@/lib/store-sdk/react";

export function App() {
  return (
    <StoreProvider
      baseUrl={import.meta.env.VITE_STORE_API_URL}
      publishableKey={import.meta.env.VITE_STORE_PUBLISHABLE_KEY}
    >
      <Catalog />
    </StoreProvider>
  );
}

function Catalog() {
  const { data, isLoading } = useCatalog({ limit: 12 });
  if (isLoading) return <p>Lädt …</p>;
  return <ul>{data?.products.map((p) => <li key={p.id}>{p.title}</li>)}</ul>;
}`;

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: "Organisation und Shop anlegen",
    body: "Im Backoffice registrieren, Organisation erstellen, ersten Shop mit Währung, Land und Steuerprofil konfigurieren.",
  },
  {
    title: "Provider im Integration Center verbinden",
    body: "Stripe, PayPal, Mollie, Resend oder eigener SMTP-Server. Zugangsdaten werden verschlüsselt serverseitig gespeichert – nie im Client.",
  },
  {
    title: "Publishable Key erzeugen",
    body: "Der Key adressiert genau einen Shop und erlaubt nur die Store-API-Operationen einer Storefront.",
  },
  {
    title: "Storefront über das SDK anbinden",
    body: "Katalog, Warenkorb, Checkout und Zahlungsarten kommen vollständig aus der API. Keine Berechnung im Client.",
  },
  {
    title: "Readiness prüfen und live gehen",
    body: "Shop-Readiness im Backoffice zeigt offene Punkte je Provider, Domain und Konfiguration vor dem Go-live.",
  },
];

function DeveloperPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 sm:px-6">
          <Link
            to="/"
            className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{SITE.name}</span>
          </Link>
          <a
            href={SITE.repoUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Github className="size-4 shrink-0" aria-hidden />
            Repository
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-14 sm:px-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs tracking-wide text-muted-foreground">
          <Terminal className="size-3.5 shrink-0 text-primary" aria-hidden />
          Store API {SITE.apiVersion} · {SITE.release}
        </p>
        <h1 className="mt-6 font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
          Von null auf erste Bestellung.
        </h1>
        <p className="mt-5 max-w-2xl text-base text-pretty text-muted-foreground">
          Commerce OS ist so gebaut, dass Menschen und KI-Agenten dieselben Regeln lesen. Diese
          Seite fasst Installation, Agenten-Setup, API und SDK zusammen.
        </p>

        <section className="mt-14">
          <h2 className="font-display text-xl font-semibold tracking-tight">1 · Installation</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Voraussetzung ist bun. Datenbank wird für <code className="rounded bg-muted px-1.5 py-0.5 text-xs">dev</code>,{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">test</code> und{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">build</code> nicht benötigt.
          </p>
          <div className="mt-5">
            <CodeBlock label="Terminal" code={INSTALL} />
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            2 · Agenten anlernen
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Kopiere diesen Block in die Regeldatei deines Agenten (Lovable, Cursor, Claude Code,
            Codex). Er verweist auf die Dokumentation im Repository statt sie zu duplizieren.
          </p>
          <div className="mt-5">
            <CodeBlock label="Agenten-Regeln" language="text" code={AGENT_BOOTSTRAP} />
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-xl font-semibold tracking-tight">3 · Prüfbefehle</h2>
          <div className="mt-5">
            <CodeBlock label="Verifikation" code={VERIFY} />
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-xl font-semibold tracking-tight">4 · Store API v1</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Öffentliche, versionierte Schnittstelle mit Publishable Key, Rate-Limits und
            DTO-Allowlist. Breaking Changes sind ausgeschlossen; Neues kommt additiv.
          </p>
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <CodeBlock label="HTTP" code={API_CURL} />
            <CodeBlock label="React SDK" language="tsx" code={SDK_REACT} />
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            5 · Weg zum ersten Shop
          </h2>
          <ol className="mt-6 grid gap-px overflow-hidden rounded-xl border border-border bg-border">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 bg-card p-6">
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-muted font-display text-sm font-semibold tabular-nums"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 rounded-xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Wichtige Dateien im Repository
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              ["AGENTS.md", "Verbindliche Regeln für jede Änderung."],
              ["docs/agent/START_HERE.md", "Orientierung in zehn Minuten."],
              ["docs/agent/STORE_API_GUIDE.md", "Endpunkte, Fehlercodes, Limits."],
              ["docs/agent/MIGRATION_RULES.md", "Schema, Grants, RLS, Reihenfolge."],
              ["src/lib/store-sdk/", "SDK-Core und React-Hooks."],
              ["docs/production/", "Umgebungen, Secrets, Rollback, Go-live."],
            ].map(([path, desc]) => (
              <div key={path} className="min-w-0">
                <dt className="id-text font-mono text-xs text-foreground">{path}</dt>
                <dd className="mt-1 text-sm text-pretty text-muted-foreground">{desc}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground sm:px-6">
        {SITE.name} · {SITE.release}
      </footer>
    </div>
  );
}
