import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { navTrail } from "./nav-registry";
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
 *
 * When the mobile topbar already shows the same label, the visible heading is
 * suppressed on small screens (the h1 stays in the accessibility tree) so a
 * page never opens with the same words twice.
 */
export function PageHeader({ title, description, eyebrow, actions, className }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const duplicate = navTrail(pathname).item === title && !eyebrow;

  return (
    <header
      className={cn(
        "mb-4 flex flex-col gap-2.5 sm:mb-5 sm:border-b sm:border-border sm:pb-4",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-2 text-xs tracking-wide text-muted-foreground">
              {eyebrow}
            </div>
          ) : null}
          <h1
            className={cn(
              "truncate font-display text-xl leading-tight font-semibold tracking-tight sm:text-[1.6rem]",
              duplicate && "sr-only sm:not-sr-only",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 hidden max-w-prose text-sm text-pretty text-muted-foreground sm:block">
              {description}
            </p>
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
