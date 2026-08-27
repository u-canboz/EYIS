import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, LogOut, Search } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AppNav } from "./AppNav";
import { DemoBanner } from "./DemoBanner";
import { BOTTOM_TABS, RAIL_ITEMS, isActive } from "./nav-registry";
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
  if (isLoading) return <Skeleton className="h-10 w-full" />;
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
        <p className="mt-2 truncate px-1 text-xs text-sidebar-foreground/60">Rolle: {roleLabel}</p>
      ) : null}
    </div>
  );
}

function Wordmark({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  return (
    <Link
      to="/app"
      onClick={onNavigate}
      className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
    >
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground"
      >
        C
      </span>
      <span className="min-w-0 truncate font-display text-sm font-semibold tracking-tight">
        Commerce OS
      </span>
    </Link>
  );
}

function SidebarBody(props: Props & { onNavigate?: (() => void) | undefined }) {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-10 min-w-0 bg-sidebar px-4 pb-3 pt-4">
        <Wordmark onNavigate={props.onNavigate} />
        <div className="mt-3">
          <OrgPicker {...props} />
        </div>
      </div>
      <div className="min-w-0 px-2 pb-4">
        <AppNav pathname={props.pathname} onNavigate={props.onNavigate} dense />
      </div>
      <div className="mt-auto min-w-0 space-y-1 border-t border-sidebar-border px-3 py-3">
        {props.email ? (
          <p className="truncate px-2 text-xs text-sidebar-foreground/60">{props.email}</p>
        ) : null}
        <Button
          variant="ghost"
          className="min-h-11 w-full justify-start gap-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={props.onSignOut}
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          Abmelden
        </Button>
      </div>
    </div>
  );
}

export function AppShell(props: Props) {
  const [open, setOpen] = useState(false);

  const navSheet = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="tap size-11" aria-label="Menü öffnen">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[min(21rem,90vw)] gap-0 bg-sidebar p-0 text-sidebar-foreground"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarBody {...props} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="flex min-h-dvh w-full bg-background">
      {/* Desktop: full sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[16.5rem] shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground xl:block">
        <SidebarBody {...props} />
      </aside>

      {/* Tablet: icon rail, never a squeezed sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-3 text-sidebar-foreground md:flex xl:hidden">
        <div className="pb-2">{navSheet}</div>
        <TooltipProvider delayDuration={200}>
          <nav aria-label="Bereiche" className="flex flex-col items-center gap-1 overflow-y-auto">
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
                      "grid size-11 place-items-center rounded-lg transition-colors",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
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
          onClick={props.onSignOut}
          aria-label="Abmelden"
          className="mt-auto grid size-11 place-items-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-5" aria-hidden />
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile topbar */}
        <header className="sticky top-0 z-30 grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background/95 px-2 backdrop-blur md:hidden">
          {navSheet}
          <Link
            to="/app"
            className="flex min-h-11 min-w-0 items-center rounded-md font-display text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="min-w-0 truncate">Commerce OS</span>
          </Link>
          <Link
            to="/app/bestellungen"
            aria-label="Bestellungen suchen"
            className="grid size-11 place-items-center rounded-lg text-muted-foreground"
          >
            <Search className="size-5" aria-hidden />
          </Link>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 md:pb-10 xl:px-8 xl:py-8">
          <div className="mx-auto flex min-w-0 max-w-[var(--content-max)] flex-col gap-4">
            {props.isDemo ? <DemoBanner /> : null}
            <div className="min-w-0">{props.children}</div>
          </div>
        </main>

        {/* Mobile bottom tabs */}
        <nav
          aria-label="Schnellzugriff"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur pb-safe md:hidden"
        >
          {BOTTOM_TABS.map((item) => {
            const Icon = item.icon;
            const active = isActive(props.pathname, item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="w-full truncate text-center">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] text-muted-foreground"
          >
            <Menu className="size-5 shrink-0" aria-hidden />
            <span>Menü</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
