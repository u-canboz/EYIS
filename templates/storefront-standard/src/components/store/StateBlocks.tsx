import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/storefront/errors";

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-4/5 w-full bg-secondary" />
          <div className="mt-4 h-3 w-2/3 bg-secondary" />
          <div className="mt-2 h-3 w-1/3 bg-secondary" />
        </div>
      ))}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-secondary ${className ?? ""}`} />;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="border border-border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Erneut versuchen
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-border p-12 text-center">
      <p className="font-display text-lg">{title}</p>
      {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
