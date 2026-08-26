import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, LogOut } from "lucide-react";
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
import { AppNav } from "./AppNav";
import { DemoBanner } from "./DemoBanner";
import { BOTTOM_TABS, isActive } from "./nav-registry";
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
          className="h-10 w-full min-w-0 border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
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

function SidebarBody(props: Props & { onNavigate?: (() => void) | undefined }) {
  return (
    <div className="flex h-full min-w-0 flex-col gap-6 overflow-y-auto px-3 py-5">
      <div className="min-w-0 px-3">
        <Link
          to="/"
          onClick={props.onNavigate}
          className="font-display text-base font-semibold tracking-tight"
        >
          Commerce OS
        </Link>
      </div>
      <div className="px-1">
        <OrgPicker {...props} />
      </div>
      <AppNav pathname={props.pathname} onNavigate={props.onNavigate} />
      <div className="mt-auto space-y-2 border-t border-sidebar-border px-1 pt-4">
        {props.email ? (
          <p className="truncate px-2 text-xs text-sidebar-foreground/60">{props.email}</p>
        ) : null}
        <Button
          variant="ghost"
          className="min-h-11 w-full justify-start gap-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={props.onSignOut}
        >
          <LogOut className="size-4" aria-hidden />
          Abmelden
        </Button>
      </div>
    </div>
  );
}

export function AppShell(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 bg-sidebar text-sidebar-foreground lg:block">
        <SidebarBody {...props} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11" aria-label="Menü öffnen">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[min(20rem,88vw)] gap-0 bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBody {...props} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link to="/app" className="min-w-0 truncate font-display font-semibold">
            Commerce OS
          </Link>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-10">
          <div className="mx-auto flex min-w-0 max-w-[var(--content-max)] flex-col gap-5">
            {props.isDemo ? <DemoBanner /> : null}
            <div className="min-w-0">{props.children}</div>
          </div>
        </main>

        <nav
          aria-label="Schnellzugriff"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur pb-safe lg:hidden"
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
