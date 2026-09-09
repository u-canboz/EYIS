import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { about, shop, story } from "@/content/shop";

export const Route = createFileRoute("/ueber-uns")({
  head: () => ({
    meta: [
      { title: `Über uns — ${shop.name}` },
      {
        name: "description",
        content:
          `${shop.name}: wer wir sind, wie wir auswählen und wofür wir stehen.`,
      },
      { property: "og:title", content: `Über uns — ${shop.name}` },
      {
        property: "og:description",
        content: `Wer wir sind und wie wir unser Sortiment auswählen.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-(--content-max) gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.22em] text-brass">{story.eyebrow}</p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
              {about.intro.title}
            </h1>
            <p className="mt-5 max-w-prose text-muted-foreground">{about.intro.text}</p>
            <p className="mt-6 flex items-center gap-2 text-sm">
              <MapPin className="size-4 shrink-0 text-brass" aria-hidden />
              {shop.addressLine}
            </p>
          </div>
          <img
            src={about.founderImage}
            alt={`Team von ${shop.name}`}
            className="aspect-4/3 w-full object-cover"
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-3xl gap-10 px-4 py-14 sm:px-6 sm:py-20">
        {[about.origin, about.selection, about.openness].map((block) => (
          <div key={block.title}>
            <h2 className="font-display text-2xl">{block.title}</h2>
            <p className="mt-3 text-muted-foreground">{block.text}</p>
          </div>
        ))}
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
          <h2 className="font-display text-2xl">{about.closing.title}</h2>
          <p className="mt-3 text-muted-foreground">{about.closing.text}</p>
          <Link
            to="/shop"
            className="mt-6 inline-flex min-h-11 items-center bg-brass px-6 text-sm text-primary-foreground transition-opacity hover:opacity-90"
          >
            {about.closing.cta}
          </Link>
        </div>
      </section>
    </div>
  );
}
