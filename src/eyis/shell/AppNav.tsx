import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { NAV_GROUPS, activeGroupId, activeNavItem, type NavItem } from "./nav-registry";
import { cn } from "@/lib/utils";

const DAILY_PATHS = ["/app", "/app/bestellungen", "/app/produkte", "/app/kunden", "/app/lager"];
const DAILY_ITEMS = DAILY_PATHS.map((path) =>
  NAV_GROUPS.flatMap((g) => g.items).find((i) => i.to === path)!,
);

/** Daily work stays one click away. Every specialist area remains discoverable below. */
export function AppNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: (() => void) | undefined;
  dense?: boolean | undefined;
}) {
  const current = activeGroupId(pathname);
  const selected = activeNavItem(pathname)?.to;
  const [open, setOpen] = useState<string | undefined>(current);
  useEffect(() => {
    setOpen(current);
  }, [current]);

  function Item({ item }: { item: NavItem }) {
    const active = selected === item.to;
    const Icon = item.icon;
    return (
      <Link
        to={item.to}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
          active
            ? "bg-accent font-semibold text-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent",
        )}
      >
        <Icon className="size-[18px] shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 break-words leading-snug">{item.label}</span>
      </Link>
    );
  }

  return (
    <nav className="flex min-w-0 flex-col gap-1" aria-label="Hauptnavigation">
      <p className="px-3 pt-1 pb-2 text-xs font-medium text-muted-foreground">Tägliche Arbeit</p>
      {DAILY_ITEMS.map((item) => (
        <Item key={item.to} item={item} />
      ))}
      <p className="mt-5 px-3 pb-2 text-xs font-medium text-muted-foreground">Alle Bereiche</p>
      {NAV_GROUPS.filter((g) => g.id !== "overview").map((group) => {
        const items = group.items.filter((i) => !DAILY_PATHS.includes(i.to));
        if (!items.length) return null;
        if (items.length === 1) return <Item key={group.id} item={items[0]!} />;
        const expanded = open === group.id;
        const Icon = group.icon;
        return (
          <div key={group.id} className="min-w-0">
            <button
              type="button"
              onClick={() => setOpen(expanded ? undefined : group.id)}
              aria-expanded={expanded}
              aria-controls={`nav-${group.id}`}
              className={cn(
                "flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors hover:bg-sidebar-accent",
                current === group.id && !DAILY_PATHS.includes(selected ?? "")
                  ? "font-semibold text-accent-foreground"
                  : "text-sidebar-foreground",
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 break-words leading-snug">{group.label}</span>
              <ChevronRight
                aria-hidden
                className={cn("size-3.5 shrink-0 transition-transform", expanded && "rotate-90")}
              />
            </button>
            <ul
              id={`nav-${group.id}`}
              hidden={!expanded}
              className="my-1 ml-5 space-y-0.5 border-l border-sidebar-border pl-2"
            >
              {items.map((item) => (
                <li key={item.to}>
                  <Item item={item} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
