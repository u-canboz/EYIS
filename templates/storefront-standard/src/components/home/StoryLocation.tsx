import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { shop, story } from "@/content/shop";

export function StoryLocation() {
  return (
    <section className="mx-auto max-w-(--content-max) px-5 pb-16 sm:px-8 sm:pb-24">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">{story.eyebrow}</p>
          <h2 className="mt-4 max-w-sm font-display text-3xl leading-tight sm:text-4xl">
            {story.title}
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">{story.text}</p>
          <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
            <Link
              to="/ueber-uns"
              className="inline-flex min-h-11 items-center bg-brass px-6 text-sm text-primary-foreground transition-opacity hover:opacity-90"
            >
              {story.cta}
            </Link>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0 text-brass" aria-hidden />
              {shop.addressLine}
            </span>
          </div>
        </div>
        <img
          src={story.image}
          alt={`Eindruck aus dem Sortiment von ${shop.name}`}
          loading="lazy"
          className="aspect-4/3 w-full object-cover sm:aspect-16/10"
        />
      </div>
    </section>
  );
}
