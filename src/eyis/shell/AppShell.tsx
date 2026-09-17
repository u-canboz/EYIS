import { useState, type ReactNode } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Menu, LogOut, Search, ChevronRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EyisLogo } from "@/eyis/brand/EyisLogo";
import { AppNav } from "./AppNav";
import { DemoBanner } from "./DemoBanner";
import { CommandPalette, useCommandPalette } from "./CommandPalette";
import { BOTTOM_TABS, RAIL_ITEMS, isActive, navTrail } from "./nav-registry";
import { EYIS_ADMIN_SCOPE_CLASS } from "@/lib/eyis/route-boundary";
import { UiScopeProvider } from "@/components/ui/ui-scope";
import { cn } from "@/lib/utils";

export type ShellOrg = { id: string; name: string };

type Props = {
  pathname: string;
  organizations: ShellOrg[];
  activeOrgId: string;
  onOrgChange: (id: string) => void;
  roleLabel?: string | undefined;
  email?: string | undefined;
  isLoading?: boolean | undefined;
  isDemo?: boolean | undefined;
  onSignOut: () => void;
  children: ReactNode;
};

function OrgPicker({
  organizations,
  activeOrgId,
  onOrgChange,
  roleLabel,
  isLoading,
}: Pick<Props, "organizations" | "activeOrgId" | "onOrgChange" | "roleLabel" | "isLoading">) {
  if (isLoading) return <Skeleton className="h-11 w-full" />;
  if (!organizations.length) return null;
  return (
    <div className="min-w-0">
      <Select value={activeOrgId} onValueChange={onOrgChange}>
        <SelectTrigger
          aria-label="Organisation wählen"
          className="h-11 w-full min-w-0 border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {organizations.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {roleLabel ? (
        <p className="mt-2 truncate px-1 text-xs tracking-wide text-sidebar-foreground/55 uppercase">
          {roleLabel}
        </p>
      ) : null}
    </div>
  );
}

function initials(email?: string | undefined) {
  const name = (email ?? "").split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  const raw = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return raw ? raw.toUpperCase() : "EY";
}

function Wordmark({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  return (
    <Link
      to="/app"
      onClick={onNavigate}
      className="flex min-w-0 items-center gap-3 rounded-md focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
    >
      <EyisLogo variant="full" width={108} />
    </Link>
  );
}

function SidebarBody(
  props: Props & { onNavigate?: (() => void) | undefined; onSearch?: (() => void) | undefined },
) {
  return (
    <div className="flex h-full min-w-0 flex-col ">
      <div className="sticky top-0 z-10 min-w-0 border-b border-sidebar-border bg-sidebar px-4 pt-4 pb-3">
        <Wordmark onNavigate={props.onNavigate} />
        <div className="mt-3">
          <OrgPicker {...props} />
        </div>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        <AppNav pathname={props.pathname} onNavigate={props.onNavigate} dense />
      </div>
      <div className="mt-auto min-w-0 border-t border-sidebar-border px-3 py-3">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground uppercase"
          >
            {initials(props.email)}
          </span>
          <span className="min-w-0 truncate text-xs text-sidebar-foreground/70">
            {props.email ?? "Angemeldet"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Abmelden"
            className="size-11 shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={props.onSignOut}
          >
            <LogOut className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppShell(props: Props) {
  const [open, setOpen] = useState(false);
  const fetching = useIsFetching();
  const palette = useCommandPalette();
  const trail = navTrail(props.pathname);

  const menuTrigger = (
    <SheetTrigger asChild>
      <Button variant="ghost" size="icon" className="tap size-11" aria-label="Menü öffnen">
        <Menu className="size-5" />
      </Button>
    </SheetTrigger>
  );

  return (
    // `eyis-admin` ist der CSS-Isolationsscope des Backoffice. Er löst alle
    // Design-Tokens lokal auf, damit eine Dedicated-Installation nicht das
    // Design-System des Kundenprojekts erbt (siehe src/lib/eyis/route-boundary).
    <UiScopeProvider value={EYIS_ADMIN_SCOPE_CLASS}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[min(21rem,90vw)] gap-0 bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody
            {...props}
            onNavigate={() => setOpen(false)}
            onSearch={() => {
              setOpen(false);
              palette.setOpen(true);
            }}
          />
        </SheetContent>
        <div
          data-eyis-runtime="backoffice"
          className={cn(EYIS_ADMIN_SCOPE_CLASS, "flex min-h-dvh w-full bg-background")}
        >
          <a
            href="#eyis-main"
            className="sr-only fixed top-3 left-3 z-50 rounded-lg bg-card p-3 text-sm shadow-lg focus:not-sr-only"
          >
            Zum Inhalt springen
          </a>
          {fetching > 0 && (
            <div
              role="progressbar"
              aria-label="Daten werden geladen"
              className="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-primary"
            />
          )}
          <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />

          {/* Desktop: full sidebar */}
          <aside className="sticky top-0 hidden h-dvh w-[16rem] shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground xl:block">
            <SidebarBody {...props} onSearch={() => palette.setOpen(true)} />
          </aside>

          {/* Tablet: icon rail, never a squeezed sidebar */}
          <aside className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-3 text-sidebar-foreground md:flex xl:hidden">
            <Link to="/app" className="pb-1" aria-label="EYIS Startseite">
              <EyisLogo variant="mark" width={30} decorative />
            </Link>
            <div className="pb-2">{menuTrigger}</div>
            <TooltipProvider delayDuration={200}>
              <nav
                aria-label="Bereiche"
                className="flex flex-col items-center gap-1 overflow-y-auto"
              >
                {RAIL_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(props.pathname, item);
                  return (
                    <Tooltip key={item.to}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.to}
                          aria-label={item.label}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "relative grid size-11 place-items-center rounded-lg transition-colors",
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )}
                        >
                          {active ? (
                            <span
                              aria-hidden
                              className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                            />
                          ) : null}
                          <Icon className="size-5" aria-hidden />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </nav>
            </TooltipProvider>
            <button
              type="button"
              onClick={() => palette.setOpen(true)}
              aria-label="Suchen"
              className="mt-auto grid size-11 place-items-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Search className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={props.onSignOut}
              aria-label="Abmelden"
              className="grid size-11 place-items-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-5" aria-hidden />
            </button>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Mobile topbar */}
            <header className="sticky top-0 z-30 grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-1 border-b border-border bg-card px-2 md:hidden">
              {menuTrigger}
              <Link
                to="/app"
                className="flex min-h-11 min-w-0 items-center rounded-md font-display text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="min-w-0 truncate">EYIS</span>
              </Link>
              <button
                type="button"
                onClick={() => palette.setOpen(true)}
                aria-label="Suchen"
                className="grid size-11 place-items-center rounded-lg text-muted-foreground"
              >
                <Search className="size-5" aria-hidden />
              </button>
            </header>

            {/* Desktop / tablet topbar */}
            <header className="sticky top-0 z-30 hidden min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-card px-4 md:grid xl:px-8">
              <div className="flex min-w-0 items-center gap-1.5 text-sm">
                <span className="truncate text-muted-foreground">{trail.group ?? "EYIS"}</span>
                {trail.item ? (
                  <>
                    <ChevronRight
                      className="size-3.5 shrink-0 text-muted-foreground/60"
                      aria-hidden
                    />
                    <span className="min-w-0 truncate font-medium">{trail.item}</span>
                  </>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => palette.setOpen(true)}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-muted "
                >
                  <Search className="size-4 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">Bereich suchen</span>
                  <kbd className="rounded border border-border px-1.5 py-0.5 text-xs">⌘K</kbd>
                </button>
                <Link
                  to="/app/system/storefront-test"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
                >
                  Shop testen <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              </div>
            </header>

            <main
              id="eyis-main"
              tabIndex={-1}
              className="min-w-0 flex-1 px-4 py-5 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 md:pb-10 xl:px-8 xl:py-8"
            >
              <div className="mx-auto flex min-w-0 max-w-[var(--content-max)] flex-col gap-4">
                {props.isDemo ? <DemoBanner /> : null}
                <div className="min-w-0">{props.children}</div>
              </div>
            </main>

            {/* Mobile bottom tabs */}
            <nav
              aria-label="Schnellzugriff"
              className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card pb-safe md:hidden"
            >
              {BOTTOM_TABS.map((item) => {
                const Icon = item.icon;
                const active = isActive(props.pathname, item);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 text-xs",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    <span className="w-full truncate text-center">
                      {item.label === "Bestellungen" ? "Aufträge" : item.label}
                    </span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 text-xs text-muted-foreground"
              >
                <Menu className="size-5 shrink-0" aria-hidden />
                <span>Menü</span>
              </button>
            </nav>
          </div>
        </div>
      </Sheet>
    </UiScopeProvider>
  );
}
