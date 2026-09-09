import { Star } from "lucide-react";

export type StoreReview = {
  id: string;
  author: string;
  rating: number;
  title?: string | null;
  body: string;
  createdAt?: string | null;
};

/** Sternanzeige. Rein visuell — Werte kommen immer von außen. */
export function ReviewStars({ rating, className = "" }: { rating: number; className?: string }) {
  const rounded = Math.round(Math.min(Math.max(rating, 0), 5));
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${rounded} von 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`size-4 shrink-0 ${index < rounded ? "fill-brass text-brass" : "text-border"}`}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

/**
 * Kundenstimmen. Es werden ausschließlich echte, übergebene Bewertungen
 * angezeigt — liegt nichts vor, erscheint der Abschnitt nicht.
 */
export function ReviewsSection({
  reviews,
  title = "Was Kundinnen und Kunden sagen",
}: {
  reviews: StoreReview[];
  title?: string;
}) {
  if (!reviews.length) return null;

  return (
    <section className="border-t border-border bg-surface">
      <div className="mx-auto max-w-(--content-max) px-4 py-16 sm:px-6 lg:py-24">
        <h2 className="font-display text-3xl leading-tight sm:text-4xl">{title}</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => (
            <figure key={review.id} className="min-w-0 border border-border bg-card p-6">
              <ReviewStars rating={review.rating} />
              {review.title ? (
                <figcaption className="mt-3 font-display text-lg leading-snug">
                  {review.title}
                </figcaption>
              ) : null}
              <blockquote className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {review.body}
              </blockquote>
              <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
                {review.author}
              </p>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
