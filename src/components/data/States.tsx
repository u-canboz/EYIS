import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Neutral empty state — never a bare "keine Daten" string in a table cell. */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: typeof Inbox;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-5 py-10 text-center",
        className,
      )}
    >
      <Icon className="size-5 text-muted-foreground" aria-hidden />
      <p className="font-medium text-pretty">{title}</p>
      {description ? (
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Daten konnten nicht geladen werden",
  description,
  action,
  className,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4",
        className,
      )}
      role="alert"
    >
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
        <p className="min-w-0 font-medium text-pretty">{title}</p>
      </div>
      {description ? (
        <p className="min-w-0 text-sm text-pretty text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

/** Shown when `can()` denies a section instead of rendering an empty page. */
export function PermissionState({ what = "diesen Bereich" }: { what?: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="Keine Berechtigung"
      description={`Deine Rolle erlaubt keinen Zugriff auf ${what}. Wende dich an eine Administratorin oder einen Administrator.`}
    />
  );
}

/** List loading placeholder that matches the record-card rhythm. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}
