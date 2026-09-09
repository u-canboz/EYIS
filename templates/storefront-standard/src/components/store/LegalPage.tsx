import { shop } from "@/content/shop";

export type LegalSection = { title: string; body: string[]; pending?: boolean };

/** Rahmen für Rechtstexte. Fehlende Abschnitte werden ehrlich markiert. */
export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro?: string;
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="font-display text-3xl sm:text-4xl">{title}</h1>
      {intro ? <p className="mt-4 text-muted-foreground">{intro}</p> : null}
      <div className="mt-10 grid gap-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-display text-xl">{section.title}</h2>
            <div className="mt-2 grid gap-2 text-sm leading-relaxed">
              {section.body.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {section.pending ? (
                <p className="border-l-2 border-brass pl-3 text-sm text-muted-foreground">
                  Text folgt — dieser Abschnitt wird vor dem Livegang durch den geprüften
                  Rechtstext ersetzt.
                </p>
              ) : null}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
        {shop.name}, {shop.addressLine} ·{" "}
        <a href={`mailto:${shop.email}`} className="underline underline-offset-4">
          {shop.email}
        </a>
      </p>
    </div>
  );
}
