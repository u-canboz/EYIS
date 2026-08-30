import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { NAV_GROUPS, activeGroupId, isActive } from "./nav-registry";
import { cn } from "@/lib/utils";

/**
 * Grouped navigation, shared by the desktop sidebar and the mobile sheet.
 * Groups collapse so a long module list stays calm; the active group is open.
 */
export function AppNav({
  pathname,
  onNavigate,
  dense,
}: {
  pathname: string;
  onNavigate?: (() => void) | undefined;
  dense?: boolean | undefined;
}) {
  const current = activeGroupId(pathname);
  const [open, setOpen] = useState<string[]>(current ? [current] : ["overview"]);

  useEffect(() => {
    if (current) setOpen((prev) => (prev.includes(current) ? prev : [...prev, current]));
  }, [current]);

  const toggle = (id: string) =>
    setOpen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <nav className="flex min-w-0 flex-col gap-0.5" aria-label="Hauptnavigation">
      {NAV_GROUPS.map((group) => {
        const expanded = open.includes(group.id);
        const groupActive = current === group.id;
        const GroupIcon = group.icon;
        return (
          <div key={group.id} className="min-w-0">
            <button
              type="button"
              onClick={() => toggle(group.id)}
              aria-expanded={expanded}
              className={cn(
                "flex w-full min-w-0 items-center gap-2.5 rounded-lg px-3 text-left text-[13px] font-medium transition-colors",
                dense ? "min-h-10" : "min-h-11",
                groupActive && !expanded
                  ? "text-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <GroupIcon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{group.label}</span>
              <ChevronRight
                aria-hidden
                className={cn(
                  "size-3.5 shrink-0 transition-transform",
                  expanded && "rotate-90",
                )}
              />
            </button>

            {expanded ? (
              <ul className="mb-1 ml-[1.4rem] flex min-w-0 flex-col gap-0.5 border-l border-sidebar-border pl-2">
                {group.items.map((item) => {
                  const active = isActive(pathname, item);
                  return (
                    <li key={item.to} className="min-w-0">
                      <Link
                        to={item.to}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-w-0 items-center gap-2 rounded-md px-2.5 text-sm transition-colors",
                          dense ? "min-h-10 lg:min-h-9" : "min-h-11",
                          active
                            ? "bg-card font-semibold text-sidebar-accent-foreground shadow-raised"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "h-4 w-0.5 shrink-0 rounded-full",
                            active ? "bg-primary" : "bg-transparent",
                          )}
                        />
                        <span className="min-w-0 truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
