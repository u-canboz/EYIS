import { Link } from "@tanstack/react-router";
import { NAV_GROUPS, isActive } from "./nav-registry";
import { cn } from "@/lib/utils";

/**
 * Grouped navigation list, shared by the desktop sidebar and the mobile sheet.
 * Scrollable by design — the only place vertical overflow is intentional here.
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
  return (
    <nav className="flex min-w-0 flex-col gap-5" aria-label="Hauptnavigation">
      {NAV_GROUPS.map((group) => (
        <div key={group.id} className="min-w-0">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/75">
            {group.label}
          </p>
          <ul className="flex min-w-0 flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <li key={item.to} className="min-w-0">
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-w-0 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                      dense ? "min-h-11 lg:min-h-10" : "min-h-11",
                      active
                        ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
