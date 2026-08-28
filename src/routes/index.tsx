import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Boxes,
  CreditCard,
  FileText,
  Layers,
  Plug,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Commerce OS – Betriebssystem für Multi-Shop-Handel" },
      {
        name: "description",
        content:
          "Bestellungen, Katalog, Bestand, Versand, Belege und Kommunikation in einem mandantenfähigen Betriebssystem – mit Store API, Rollen und lückenlosem Audit-Log.",
      },
      { property: "og:title", content: "Commerce OS – Betriebssystem für Multi-Shop-Handel" },
      {
        property: "og:description",
        content:
          "Ein Operations-Kern für Verkauf, Katalog, Lager, Finanzen und Kommunikation – mandantenfähig, auditierbar, API-first.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

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

const PRINCIPLES = [
  ["Mandantenfähig", "Organisationen und Shops sind auf Datenbankebene getrennt – ohne Ausnahme."],
  ["Serverseitige Wahrheit", "Preise, Steuern, Bestände und Summen berechnet ausschließlich der Server."],
  ["Unveränderliche Spuren", "Belege, Steuersnapshots und Zahlungsereignisse werden nie überschrieben."],
  ["API-first", "Jede Storefront spricht über die stabile Store API v1 und das TypeScript-SDK."],
];

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
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-md bg-primary font-display text-sm font-bold text-primary-foreground"
            >
              C
            </span>
            <span className="min-w-0 truncate font-display text-base font-semibold tracking-tight">
              Commerce OS
            </span>
          </span>
          <Button
            className="min-h-11 shrink-0"
            variant={signedIn ? "default" : "outline"}
            onClick={() => navigate({ to: signedIn ? "/app" : "/auth" })}
          >
            {signedIn ? "Zum Backoffice" : "Anmelden"}
          </Button>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-16 sm:px-6 sm:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs tracking-wide text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden />
            Release Candidate 1 · V1 eingefroren
          </p>
          <h1 className="mt-6 max-w-3xl font-display text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
            Das Betriebssystem für deinen gesamten Handel.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">
            Ein Operations-Kern für Verkauf, Katalog, Bestand, Versand, Finanzen und Kommunikation.
            Mandantenfähig getrennt, serverseitig berechnet, lückenlos protokolliert – und über eine
            stabile API an jede Storefront angebunden.
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
              to="/store"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border px-6 text-sm font-medium transition-colors hover:bg-muted"
            >
              Referenz-Storefront ansehen
            </Link>
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
            <h2 className="font-display text-sm tracking-[0.18em] text-muted-foreground uppercase">
              Module
            </h2>
            <div className="mt-8 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
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

      <footer className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground sm:px-6">
        Commerce OS · Release Candidate 1
      </footer>
    </div>
  );
}
