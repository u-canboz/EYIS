import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Content section. On mobile it is a plain band separated by whitespace and a
 * divider; from `sm` it becomes a light surface with a single hairline border.
 * Deliberately no shadow — elevation is reserved for floating layers.
 */
export function SectionPanel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  flush,
}: {
  title?: ReactNode | undefined;
  description?: ReactNode | undefined;
  /** Small right-aligned link/button, e.g. "Alle anzeigen". */
  action?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  bodyClassName?: string | undefined;
  /** Remove body padding (lists bring their own). */
  flush?: boolean | undefined;
}) {
  return (
    <section
      className={cn(
        "min-w-0 border-border bg-card sm:rounded-xl sm:border",
        "-mx-4 border-y sm:mx-0",
        className,
      )}
    >
      {title ? (
        <header className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pt-3.5 pb-2.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="min-w-0 truncate font-display text-[0.95rem] font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn("min-w-0", !flush && "px-4 pt-1 pb-4 sm:px-5", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

/** "Alle anzeigen" style link for section headers. */
export function SectionLink({
  to,
  params,
  children = "Alle anzeigen",
}: {
  to: string;
  params?: Record<string, string> | undefined;
  children?: ReactNode | undefined;
}) {
  return (
    <Link
      to={to}
      {...(params ? { params } : {})}
      className="-mr-1.5 inline-flex min-h-9 items-center gap-0.5 rounded-md px-1.5 text-xs font-medium text-primary hover:underline"
    >
      {children}
      <ChevronRight className="size-3.5" aria-hidden />
    </Link>
  );
}
