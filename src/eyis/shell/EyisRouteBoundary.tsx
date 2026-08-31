/**
 * EyisRouteBoundary — die gerenderte Grenze zwischen Kunden-Chrome und
 * EYIS-Runtime (Phase 29).
 *
 * Der frühere Integration-Patch hat im Kunden-Root-Layout ein `return <Outlet />`
 * an den Anfang der Komponente gesetzt. Das umging jeden Provider des
 * Kundenprojekts (QueryClientProvider, Theme, Auth) und setzte zudem einen
 * `useRouterState`-Aufruf voraus, dessen Import nicht zuverlässig vorhanden war.
 *
 * Stattdessen liefert EYIS diese Komponente mit. Sie wird INNERHALB der
 * bestehenden Provider platziert und ersetzt dort ausschließlich das Chrome:
 * auf EYIS-Routen rendert sie den blanken `<Outlet />`, sonst unverändert die
 * Kinder des Kundenprojekts.
 */

import { Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { isEyisInternalRoute, type EyisOptionalModule } from "@/lib/eyis/route-boundary";

export function EyisRouteBoundary({
  children,
  modules = [],
}: {
  children: ReactNode;
  modules?: EyisOptionalModule[];
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (isEyisInternalRoute(pathname, modules)) return <Outlet />;
  return <>{children}</>;
}

export default EyisRouteBoundary;
