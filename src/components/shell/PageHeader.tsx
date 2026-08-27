import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: ReactNode | undefined;
  /** Secondary context line (breadcrumb, id, status chips). */
  eyebrow?: ReactNode | undefined;
  actions?: ReactNode | undefined;
  className?: string | undefined;
};

/**
 * Standard page header. Uses a two-column grid on narrow viewports so a long
 * title truncates instead of pushing actions out of the viewport.
 */
export function PageHeader({ title, description, eyebrow, actions, className }: Props) {
  return (
    <header className={cn("mb-6 flex flex-col gap-3", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-pretty text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
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
        "sticky bottom-0 z-30 -mx-4 mt-6 flex items-center gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur pb-safe sm:mx-0 sm:rounded-xl sm:border",
        className,
      )}
    >
      {children}
    </div>
  );
}
