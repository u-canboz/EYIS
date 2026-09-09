import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { authEmails } from "@/lib/email-templates/auth";
import { shop } from "@/content/shop";

const templates = [
  { key: "signup", label: "Konto-Bestätigung" },
  { key: "recovery", label: "Passwort zurücksetzen" },
  { key: "magiclink", label: "Anmeldelink" },
  { key: "invite", label: "Einladung" },
  { key: "email_change", label: "Adressänderung" },
  { key: "reauthentication", label: "Sicherheitscode" },
] as const;

type TemplateKey = (typeof templates)[number]["key"];

export const Route = createFileRoute("/email-vorschau")({
  head: () => ({
    meta: [{ title: `E-Mail-Vorschau — ${shop.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: EmailPreviewPage,
});

function EmailPreviewPage() {
  const [active, setActive] = useState<TemplateKey>("signup");

  const html = useMemo(
    () =>
      authEmails[active]({
        actionUrl: "https://example.com/auth/confirm?token=vorschau",
        name: "Ahmad",
        newEmail: "ahmad.neu@example.com",
        otp: "482916",
      }),
    [active],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Nur zur Vorschau
      </p>
      <h1 className="mt-1 font-heading text-3xl">E-Mail-Vorlagen im Markendesign</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        So sehen die E-Mails aus, die das Konto verschickt. Der Versand im eigenen Design startet,
        sobald die Versand-Domain eingerichtet ist.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`rounded-sm border px-4 py-2 text-sm font-medium transition-colors ${
              active === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-sm border bg-[#f6f1e7]">
        <iframe
          key={active}
          title={`Vorschau: ${templates.find((t) => t.key === active)?.label}`}
          srcDoc={html}
          className="h-[820px] w-full"
        />
      </div>
    </div>
  );
}
