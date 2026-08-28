import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Boxes,
  Bot,
  CreditCard,
  Database,
  FileText,
  Github,
  Layers,
  Lock,
  Plug,
  ShieldCheck,
  Terminal,
  Truck,
  Workflow,
} from "lucide-react";
import { EyisLogo } from "@/components/brand/EyisLogo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/site/CodeBlock";
import { SITE } from "@/lib/site-meta";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EYIS – Betriebssystem für Multi-Shop-Handel" },
      {
        name: "description",
        content:
          "EYIS ist die mandantenfähige Commerce-Engine mit Store API v1, SDK und Backoffice. Whitepaper, Architektur und Agenten-Setup in einer Seite.",
      },
      { property: "og:title", content: "EYIS – Betriebssystem für Multi-Shop-Handel" },
      {
        property: "og:description",
        content:
          "Verkauf, Katalog, Bestand, Versand, Belege und Kommunikation in einem auditierbaren, API-first Kern – inklusive Agenten-Setup.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const NUMBERS: Array<[string, string]> = [
  ["v1", "stabile Store API"],
  ["100 %", "serverseitige Berechnung"],
  ["RLS", "auf jeder Fachtabelle"],
  ["1 Kern", "beliebig viele Shops"],
];

const MODULES = [
  {
    icon: CreditCard,
    title: "Verkauf",
    body: "Warenkorb, Checkout, Zahlungen und Bestellungen als ein durchgehender, serverseitig berechneter Prozess.",
  },
  {
    icon: Layers,
    title: "Katalog & Preise",
    body: "Blueprints, Varianten, Preislisten, Kundengruppen und Promotions – eine Quelle für jeden Kanal.",
  },
  {
    icon: Boxes,
    title: "Bestand",
    body: "Bewegungsbasierte Bestände mit Reservierungen, Wareneingang, Transfers und Mehrlagerlogik.",
  },
  {
    icon: Truck,
    title: "Fulfillment & Versand",
    body: "Kommissionierung, Pakete, Labels und Tracking – bis zur Retoure und Gutschrift.",
  },
  {
    icon: FileText,
    title: "Belege & Steuern",
    body: "Rechnungen, Gutschriften und Steuersnapshots, unveränderlich und nachvollziehbar archiviert.",
  },
  {
    icon: Plug,
    title: "Integrationen",
    body: "Stripe, PayPal, Mollie, Resend und eigener SMTP-Server über ein zentrales Integration Center.",
  },
];

const PRINCIPLES: Array<[string, string]> = [
  ["Mandantenfähig", "Organisationen und Shops sind auf Datenbankebene getrennt – ohne Ausnahme."],
  [
    "Serverseitige Wahrheit",
    "Preise, Steuern, Bestände und Summen berechnet ausschließlich der Server.",
  ],
  ["Unveränderliche Spuren", "Belege, Steuersnapshots und Zahlungsereignisse werden nie überschrieben."],
  ["API-first", "Jede Storefront spricht über die stabile Store API v1 und das TypeScript-SDK."],
];

const LAYERS = [
  {
    icon: Database,
    title: "Datenschicht",
    body: "Postgres mit Row Level Security, Grants pro Rolle und Migrationen als einzige Quelle für Schemaänderungen.",
  },
  {
    icon: Workflow,
    title: "Engine-Schicht",
    body: "Pricing, Tax, Inventory, Payments, Fulfillment und Dokumente laufen als getestete Engines im Server-Code.",
  },
  {
    icon: Plug,
    title: "Store API v1",
    body: "Öffentliche, versionierte HTTP-Schnittstelle mit Publishable Key, Rate-Limits und DTO-Allowlist.",
  },
  {
    icon: Terminal,
    title: "SDK & Storefronts",
    body: "TypeScript-SDK plus React-Hooks. Storefronts kennen weder Datenbank noch Secrets.",
  },
];

const SDK_SNIPPET = `import { createStoreClient } from "@/lib/store-sdk";

const store = createStoreClient({
  baseUrl: "https://deine-domain.tld/api/public/store/v1",
  publishableKey: import.meta.env.VITE_STORE_PUBLISHABLE_KEY,
});

const { products } = await store.catalog.list({ limit: 12 });
const cart = await store.cart.create();
await store.cart.addItem(cart.id, { variantId: products[0].variants[0].id, quantity: 1 });

// Zahlungsarten kommen vom Server – nie hartcodiert im Client.
const methods = await store.checkout.paymentMethods(cart.id);`;

const AGENT_SNIPPET = `# 1. Repository klonen
git clone ${SITE.repoUrl}.git
cd commerce-os

# 2. Abhängigkeiten und Entwicklungsserver
bun install
bun run dev        # http://localhost:8080

# 3. Vor jedem Abschluss – Pflichtlauf für Agenten
bun run verify     # docs:validate + typecheck + test + build`;

const AGENT_PROMPT = `Lies zuerst AGENTS.md, dann docs/agent/START_HERE.md und
docs/agent/OPERATING_MODES.md. Ordne meinen Auftrag einer Betriebsart zu,
bevor du Code schreibst.

Harte Regeln:
- Jede Abfrage filtert nach organization_id (und shop_id, wo vorhanden).
- Neue Tabellen: CREATE TABLE -> GRANT -> ENABLE RLS -> CREATE POLICY.
- Storefronts nutzen ausschließlich @/lib/store-sdk, niemals Supabase direkt.
- Beträge, Steuern und Bestände rechnet nur der Server.
- Abschluss erst nach grünem "bun run verify".`;

function Landing() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="EYIS Startseite">
            <EyisLogo variant="mark" width={28} decorative />
            <EyisLogo variant="wordmark" width={92} />
          </Link>
          <span className="flex shrink-0 items-center gap-2">
            <Link
              to="/entwickler"
              className="hidden min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Entwickler
            </Link>
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Github className="size-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Repository</span>
            </a>
            <Button
              className="min-h-11 shrink-0"
              variant={signedIn ? "default" : "outline"}
              onClick={() => navigate({ to: signedIn ? "/app" : "/auth" })}
            >
              {signedIn ? "Backoffice" : "Anmelden"}
            </Button>
          </span>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-16 sm:px-6 sm:pt-20">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs tracking-wide text-muted-foreground">
                <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden />
                {SITE.release} · V1 eingefroren
              </p>
              <h1 className="mt-6 max-w-3xl font-display text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
                Das Betriebssystem für deinen gesamten Handel.
              </h1>
              <p className="mt-6 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">
                Ein Operations-Kern für Verkauf, Katalog, Bestand, Versand, Finanzen und
                Kommunikation. Mandantenfähig getrennt, serverseitig berechnet, lückenlos
                protokolliert – und über eine stabile API an jede Storefront angebunden.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  size="lg"
                  className="min-h-12 gap-2"
                  onClick={() => navigate({ to: signedIn ? "/app" : "/auth" })}
                >
                  {signedIn ? "Backoffice öffnen" : "Organisation anlegen"}
                  <ArrowRight className="size-4 shrink-0" aria-hidden />
                </Button>
                <Link
                  to="/entwickler"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border px-6 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <Bot className="size-4 shrink-0" aria-hidden />
                  In 5 Minuten mit deinem Agenten starten
                </Link>
              </div>
              <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
                {NUMBERS.map(([value, label]) => (
                  <div key={label} className="min-w-0">
                    <dt className="font-display text-2xl font-semibold tracking-tight tabular-nums">
                      {value}
                    </dt>
                    <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="min-w-0">
              <CodeBlock label="storefront.ts · Store SDK" language="typescript" code={SDK_SNIPPET} />
            </div>
          </div>
        </section>

        {/* Module */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
            <h2 className="font-display text-sm tracking-[0.18em] text-muted-foreground uppercase">
              Module
            </h2>
            <p className="mt-3 max-w-2xl font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Ein Kern statt sechs Insellösungen.
            </p>
            <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((m) => (
                <article key={m.title} className="min-w-0">
                  <m.icon className="size-5 shrink-0 text-primary" aria-hidden />
                  <h3 className="mt-3 font-display text-base font-semibold tracking-tight">
                    {m.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                    {m.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Architektur / Whitepaper */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
          <h2 className="font-display text-sm tracking-[0.18em] text-muted-foreground uppercase">
            Architektur
          </h2>
          <p className="mt-3 max-w-2xl font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Vier Schichten, klare Grenzen.
          </p>
          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
            <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
              {LAYERS.map((l, i) => (
                <li key={l.title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 bg-card p-6">
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
                  >
                    <l.icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-semibold tracking-tight">
                      <span className="text-muted-foreground tabular-nums">0{i + 1} · </span>
                      {l.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">
                      {l.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="min-w-0 rounded-xl border border-border bg-card p-6">
              <h3 className="font-display text-base font-semibold tracking-tight">
                Was das praktisch bedeutet
              </h3>
              <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-muted-foreground">
                <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                  <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    Eine kompromittierte Storefront kann keine fremden Daten lesen – sie besitzt nur
                    einen Publishable Key mit engem Scope.
                  </span>
                </li>
                <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    Manipulierte Beträge im Client sind wirkungslos: Summen, Steuern und Bestände
                    entstehen ausschließlich serverseitig.
                  </span>
                </li>
                <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                  <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    Rechnungen und Steuersnapshots sind unveränderlich; Korrekturen laufen als
                    Gutschrift oder Storno.
                  </span>
                </li>
                <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                  <Plug className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    Zahlungsarten werden entdeckt, nicht hartcodiert – neue Provider erscheinen ohne
                    Storefront-Deploy.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Agenten-Setup */}
        <section className="border-y border-border bg-surface" id="setup">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
            <h2 className="font-display text-sm tracking-[0.18em] text-muted-foreground uppercase">
              Setup für KI-Agenten
            </h2>
            <p className="mt-3 max-w-2xl font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Dein Agent liest die Regeln, bevor er Code schreibt.
            </p>
            <p className="mt-4 max-w-2xl text-sm text-pretty text-muted-foreground">
              Das Repository enthält eine maschinenlesbare Agenten-Dokumentation:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">AGENTS.md</code>,{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">docs/agent/*</code> und
              Manifeste für Module, Routen und die Store API.
            </p>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <CodeBlock label="Installation" code={AGENT_SNIPPET} />
              <CodeBlock label="Agenten-Prompt" language="text" code={AGENT_PROMPT} />
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href={SITE.repoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Github className="size-4 shrink-0" aria-hidden />
                Repository öffnen
              </a>
              <Link
                to="/entwickler"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border px-6 text-sm font-medium transition-colors hover:bg-muted"
              >
                Vollständige Anleitung
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* Prinzipien */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
          <h2 className="font-display text-sm tracking-[0.18em] text-muted-foreground uppercase">
            Prinzipien
          </h2>
          <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
            {PRINCIPLES.map(([title, body]) => (
              <div key={title} className="min-w-0 bg-card p-6">
                <dt className="font-display text-base font-semibold tracking-tight">{title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                  {body}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                Bereit für den ersten echten Shop.
              </h2>
              <p className="mt-3 max-w-xl text-sm text-pretty text-muted-foreground">
                Zugangsdaten im Integration Center hinterlegen, Readiness prüfen, live gehen.
              </p>
            </div>
            <Button
              size="lg"
              className="min-h-12 gap-2 lg:shrink-0"
              onClick={() => navigate({ to: signedIn ? "/app" : "/auth" })}
            >
              {signedIn ? "Backoffice öffnen" : "Loslegen"}
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-8 text-xs text-muted-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6">
          <span className="flex min-w-0 flex-col gap-2">
            <EyisLogo variant="wordmark-claim" width={200} />
            <span className="min-w-0">{SITE.name} · {SITE.release}</span>
          </span>
          <span className="flex flex-wrap gap-4">
            <Link to="/entwickler" className="hover:text-foreground">
              Entwickler
            </Link>
            <Link to="/store" className="hover:text-foreground">
              Referenz-Storefront
            </Link>
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-foreground"
            >
              GitHub
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
