import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Commerce OS – Fundament für Multi-Shop-Handel" },
      {
        name: "description",
        content:
          "Mandantenfähige Handelsplattform: Organisationen, Shops, granulare Rollen, Token-Einladungen und ein unveränderliches Audit-Log.",
      },
      { property: "og:title", content: "Commerce OS – Fundament für Multi-Shop-Handel" },
      {
        property: "og:description",
        content:
          "Mandantenfähige Handelsplattform: Organisationen, Shops, granulare Rollen, Token-Einladungen und ein unveränderliches Audit-Log.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    title: "Mandantenfähig ab Zeile eins",
    body: "Organisationen und Shops sind auf Datenbankebene isoliert. Row-Level-Security lässt keinen Blick über den Mandantenrand zu.",
  },
  {
    title: "Zehn granulare Rollen",
    body: "Vom Inhaber bis „Nur Lesen“ – Berechtigungen liegen in Daten, nicht im Code, und lassen sich pro Organisation prüfen.",
  },
  {
    title: "Einladungen mit Token",
    body: "Server speichert nur den Hash. Ablaufdatum, Widerruf und Einmalverwendung sind Teil des Modells, nicht des Wunschdenkens.",
  },
  {
    title: "Unveränderliches Audit-Log",
    body: "Nur Einfügen. Änderungen und Löschungen sind per Datenbank-Trigger blockiert – auch für den Server.",
  },
  {
    title: "Outbox & Idempotenz",
    body: "Event-Outbox und Idempotenzschlüssel sind vorbereitet, damit spätere Integrationen ohne Umbau andocken.",
  },
  {
    title: "Shops mit eigenen Domains",
    body: "Währung, Sprache, Status und Domains pro Shop – die Basis für Katalog, Warenkorb und Checkout.",
  },
];

function Landing() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-semibold">Commerce OS</span>
        <Button
          variant={signedIn ? "default" : "outline"}
          onClick={() => navigate({ to: signedIn ? "/app" : "/auth" })}
        >
          {signedIn ? "Zum Backoffice" : "Anmelden"}
        </Button>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Phase 0 · Fundament
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl leading-[1.05] font-semibold sm:text-6xl">
            Das Fundament für deinen gesamten Handel.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Organisationen, Shops, Rollen und Einladungen – sauber getrennt, streng abgesichert und
            lückenlos protokolliert. Alles Weitere baut darauf auf.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => navigate({ to: signedIn ? "/app" : "/auth" })}>
              {signedIn ? "Backoffice öffnen" : "Organisation anlegen"}
            </Button>
            <Link
              to="/auth"
              className="inline-flex items-center rounded-md border px-5 py-2.5 text-sm font-medium"
            >
              Ich habe eine Einladung
            </Link>
          </div>
        </section>

        <section className="border-y bg-surface">
          <div className="mx-auto grid max-w-6xl gap-px bg-border px-0 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="bg-surface p-8">
                <h2 className="text-lg font-semibold">{f.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold">Was als Nächstes kommt</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ["Phase 1", "Produkt-Engine mit Blueprints und Variantenmatrix"],
              ["Phase 2", "Katalog, Preise, Bestände und Medien"],
              ["Phase 3", "Warenkorb, Checkout und Bestellungen"],
            ].map(([phase, text]) => (
              <li key={phase} className="rounded-lg border p-6">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{phase}</p>
                <p className="mt-2 text-sm">{text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t px-6 py-8 text-center text-xs text-muted-foreground">
        Commerce OS · Phase 0
      </footer>
    </div>
  );
}
