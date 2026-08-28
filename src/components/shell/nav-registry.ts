import {
  LayoutDashboard,
  Package,
  Tags,
  Euro,
  Warehouse,
  Plug,
  Megaphone,
  Truck,
  Receipt,
  ShoppingCart,
  ClipboardList,
  ClipboardCheck,
  Users,
  RotateCcw,
  FileText,
  Mail,
  Workflow,
  CheckSquare,
  CreditCard,
  Store,
  Activity,
  ServerCog,
  Gauge,
  Wand2,
  TriangleAlert,
  FlaskConical,
  Code2,
  Images,
  UserCog,
  Building2,
  ScrollText,
  Layers,
  MapPin,
  ArrowLeftRight,
  PackageOpen,
  Boxes,
  SlidersHorizontal,
  Palette,
  History,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Extra words that should match in the command palette. */
  keywords?: string;
};
export type NavGroup = { id: string; label: string; icon: LucideIcon; items: NavItem[] };

/** Single source of truth for backoffice navigation (sidebar, rail, sheet, palette). */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Übersicht",
    icon: LayoutDashboard,
    items: [
      {
        to: "/app",
        label: "Dashboard",
        icon: LayoutDashboard,
        exact: true,
        keywords: "start home kennzahlen",
      },
    ],
  },
  {
    id: "sales",
    label: "Verkauf",
    icon: ClipboardList,
    items: [
      { to: "/app/bestellungen", label: "Bestellungen", icon: ClipboardList, keywords: "orders" },
      { to: "/app/zahlungen", label: "Zahlungen", icon: CreditCard, keywords: "payments refunds" },
      {
        to: "/app/warenkoerbe",
        label: "Warenkörbe & Checkouts",
        icon: ShoppingCart,
        keywords: "carts sessions",
      },
      { to: "/app/marketing/promotions", label: "Promotions", icon: Megaphone, keywords: "rabatte" },
    ],
  },
  {
    id: "catalog",
    label: "Katalog",
    icon: Package,
    items: [
      { to: "/app/produkte", label: "Produkte", icon: Package, keywords: "artikel varianten" },
      { to: "/app/kategorien", label: "Kategorien & Collections", icon: Tags },
      { to: "/app/preise", label: "Preise", icon: Euro, keywords: "pricing preislisten" },
      { to: "/app/preise/testen", label: "Preistest", icon: SlidersHorizontal },
      { to: "/app/medien", label: "Medien", icon: Images, keywords: "bilder assets" },
    ],
  },
  {
    id: "logistics",
    label: "Lager & Versand",
    icon: Warehouse,
    items: [
      { to: "/app/lager", label: "Bestand", icon: Boxes, keywords: "inventar lager" },
      { to: "/app/lager/lagerorte", label: "Lagerorte", icon: MapPin },
      { to: "/app/lager/bewegungen", label: "Bewegungen", icon: History },
      { to: "/app/lager/wareneingang", label: "Wareneingang", icon: PackageOpen },
      { to: "/app/lager/transfers", label: "Transfers", icon: ArrowLeftRight },
      { to: "/app/lager/reservierungen", label: "Reservierungen", icon: Layers },
      { to: "/app/versand", label: "Fulfillment & Versand", icon: Truck, keywords: "shipping" },
      { to: "/app/versand/versandarten", label: "Versandarten", icon: Truck },
      { to: "/app/versand/dienstleister", label: "Carrier", icon: Truck, keywords: "dienstleister" },
    ],
  },
  {
    id: "customers",
    label: "Kunden",
    icon: Users,
    items: [
      { to: "/app/kunden", label: "Kunden & Gruppen", icon: Users },
      { to: "/app/retouren", label: "Retouren", icon: RotateCcw, keywords: "returns rma" },
      { to: "/app/retouren/einstellungen", label: "Retouren-Regeln", icon: SlidersHorizontal },
      { to: "/portal", label: "Kundenportal", icon: Store, keywords: "self service" },
    ],
  },
  {
    id: "finance",
    label: "Finanzen",
    icon: FileText,
    items: [
      {
        to: "/app/dokumente",
        label: "Rechnungen & Gutschriften",
        icon: FileText,
        keywords: "belege invoices",
      },
      { to: "/app/dokumente/einstellungen", label: "Dokument-Einstellungen", icon: SlidersHorizontal },
      { to: "/app/steuern", label: "Steuern", icon: Receipt, keywords: "tax ust vat" },
    ],
  },
  {
    id: "communication",
    label: "Kommunikation",
    icon: Mail,
    items: [
      { to: "/app/kommunikation", label: "Übersicht", icon: Mail },
      { to: "/app/kommunikation/vorlagen", label: "Vorlagen", icon: FileText, keywords: "templates" },
      { to: "/app/kommunikation/verlauf", label: "Versandprotokoll", icon: History },
      { to: "/app/kommunikation/branding", label: "Branding Studio", icon: Palette },
      { to: "/app/kommunikation/regeln", label: "Sende-Regeln", icon: SlidersHorizontal },
      { to: "/app/automationen", label: "Automationen", icon: Workflow },
      { to: "/app/automationen/verlauf", label: "Automations-Verlauf", icon: History },
      { to: "/app/automationen/webhooks", label: "Webhooks", icon: Plug },
      { to: "/app/automationen/aufgaben", label: "Aufgaben", icon: CheckSquare },
    ],
  },
  {
    id: "integrations",
    label: "Integrationen",
    icon: Plug,
    items: [
      {
        to: "/app/einstellungen/integrationen",
        label: "Integration Center",
        icon: Plug,
        keywords: "stripe paypal mollie resend smtp carrier",
      },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: Activity,
    items: [
      { to: "/app/system/einrichtung", label: "Einrichtung", icon: Wand2 },
      { to: "/app/system/health", label: "Health", icon: Activity },
      { to: "/app/system/jobs", label: "Jobs & Queues", icon: ServerCog },
      { to: "/app/system/status", label: "Status", icon: Gauge },
      { to: "/app/system/errors", label: "Fehler", icon: TriangleAlert },
      { to: "/app/system/demo-daten", label: "Demo & QA", icon: FlaskConical },
    ],
  },
  {
    id: "developer",
    label: "Entwickler",
    icon: Code2,
    items: [
      { to: "/app/entwickler", label: "API-Keys", icon: Code2 },
      { to: "/app/entwickler/api", label: "API-Referenz", icon: FileText },
      { to: "/app/entwickler/protokoll", label: "Request-Protokoll", icon: History },
      { to: "/app/system/storefront-test", label: "Test-Storefront", icon: Store },
      { to: "/store", label: "Referenz-Storefront", icon: Store },
    ],
  },
  {
    id: "settings",
    label: "Einstellungen",
    icon: Settings,
    items: [
      { to: "/app/shops", label: "Shops", icon: Building2 },
      { to: "/app/team", label: "Team", icon: UserCog, keywords: "rollen mitglieder" },
      { to: "/app/audit", label: "Audit-Log", icon: ScrollText },
      { to: "/app/system/release-readiness", label: "Release Readiness", icon: ClipboardCheck },
    ],
  },
];

/** 4 core areas + menu for the mobile bottom bar. */
export const BOTTOM_TABS: NavItem[] = [
  { to: "/app", label: "Übersicht", icon: LayoutDashboard, exact: true },
  { to: "/app/bestellungen", label: "Bestellungen", icon: ClipboardList },
  { to: "/app/produkte", label: "Produkte", icon: Package },
  { to: "/app/lager", label: "Lager", icon: Warehouse },
];

/** Compact icon rail for tablet widths — one entry per functional area. */
export const RAIL_ITEMS: NavItem[] = [
  { to: "/app", label: "Übersicht", icon: LayoutDashboard, exact: true },
  { to: "/app/bestellungen", label: "Bestellungen", icon: ClipboardList },
  { to: "/app/produkte", label: "Produkte", icon: Package },
  { to: "/app/kunden", label: "Kunden", icon: Users },
  { to: "/app/lager", label: "Lager", icon: Warehouse },
  { to: "/app/versand", label: "Versand", icon: Truck },
  { to: "/app/dokumente", label: "Dokumente", icon: FileText },
  { to: "/app/kommunikation", label: "Kommunikation", icon: Mail },
  { to: "/app/einstellungen/integrationen", label: "Integrationen", icon: Plug },
  { to: "/app/system/health", label: "System", icon: Activity },
];

export function isActive(pathname: string, item: NavItem) {
  return item.exact
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(item.to + "/");
}

/** The group that owns the current route — used to auto-expand the sidebar. */
export function activeGroupId(pathname: string): string | undefined {
  let best: { id: string; length: number } | undefined;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isActive(pathname, item) && (!best || item.to.length > best.length)) {
        best = { id: group.id, length: item.to.length };
      }
    }
  }
  return best?.id;
}

/** Human readable trail for the topbar, e.g. "Verkauf · Bestellungen". */
export function navTrail(pathname: string): { group?: string; item?: string } {
  let best: { group: string; item: string; length: number } | undefined;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isActive(pathname, item) && (!best || item.to.length > best.length)) {
        best = { group: group.label, item: item.label, length: item.to.length };
      }
    }
  }
  return best ? { group: best.group, item: best.item } : {};
}
