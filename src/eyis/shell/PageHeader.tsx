import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: ReactNode | undefined;
  eyebrow?: ReactNode | undefined;
  actions?: ReactNode | undefined;
  className?: string | undefined;
};

/** Shared page hierarchy: readable title, context and wrapping primary actions. */
export function PageHeader({ title, description, eyebrow, actions, className }: Props) {
  return (
    <header className={cn("mb-6 flex flex-col gap-3", className)}>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-2 text-xs tracking-wide text-muted-foreground">
              {eyebrow}
            </div>
          ) : null}
          <h1
            className={cn(
              "break-words font-display text-2xl leading-tight font-semibold tracking-tight sm:text-3xl",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

/**
 * Sticky action bar for mobile primary actions. Respects the safe area and the
 * dynamic viewport so the on-screen keyboard never hides the action.
 */
export function StickyActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] md:bottom-4 z-30 -mx-4 mt-6 flex items-center gap-2 border-t border-border bg-card px-4 py-3 pb-safe sm:mx-0 sm:rounded-xl sm:border",
        className,
      )}
    >
      {children}
    </div>
  );
}
