import { reviewSummary } from "@/content/conversion";
import { ReviewStars } from "./Reviews";

/**
 * Kompakte Bewertungszeile. Ohne belegbare Bewertungen wird nichts angezeigt —
 * die Vorlage erfindet keine Durchschnittsnoten.
 */
export function ReviewSummary({ className = "" }: { className?: string }) {
  if (!reviewSummary || reviewSummary.count <= 0) return null;
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm ${className}`}>
      <ReviewStars rating={reviewSummary.average} />
      <span className="tabular-nums">{reviewSummary.average.toFixed(1)} von 5</span>
      <span className="text-muted-foreground">
        aus {reviewSummary.count.toLocaleString("de-DE")} Bewertungen
      </span>
    </div>
  );
}
