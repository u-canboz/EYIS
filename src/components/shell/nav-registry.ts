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
  TriangleAlert,
  FlaskConical,
  Code2,
  Images,
  UserCog,
  Building2,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { to: string; label: string; icon: LucideIcon; exact?: boolean };
export type NavGroup = { id: string; label: string; items: NavItem[] };

/** Single source of truth for backoffice navigation (desktop sidebar + mobile sheet). */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Start",
    items: [{ to: "/app", label: "Übersicht", icon: LayoutDashboard, exact: true }],
  },
  {
    id: "catalog",
    label: "Katalog",
    items: [
      { to: "/app/produkte", label: "Produkte", icon: Package },
      { to: "/app/kategorien", label: "Kategorien & Collections", icon: Tags },
      { to: "/app/preise", label: "Preise", icon: Euro },
      { to: "/app/preise/testen", label: "Preistest", icon: Euro },
      { to: "/app/medien", label: "Medien", icon: Images },
    ],
  },
  {
    id: "sales",
    label: "Verkauf",
    items: [
      { to: "/app/bestellungen", label: "Bestellungen", icon: ClipboardList },
      { to: "/app/warenkoerbe", label: "Warenkörbe & Checkouts", icon: ShoppingCart },
      { to: "/app/zahlungen", label: "Zahlungen", icon: CreditCard },
      { to: "/app/retouren", label: "Retouren", icon: RotateCcw },
      { to: "/app/retouren/einstellungen", label: "Retouren-Regeln", icon: RotateCcw },
      { to: "/app/marketing/promotions", label: "Promotions", icon: Megaphone },
    ],
  },
  {
    id: "customers",
    label: "Kunden",
    items: [{ to: "/app/kunden", label: "Kunden & Gruppen", icon: Users }],
  },
  {
    id: "logistics",
    label: "Logistik",
    items: [
      { to: "/app/lager", label: "Lagerübersicht", icon: Warehouse },
      { to: "/app/lager/bewegungen", label: "Bewegungen", icon: Warehouse },
      { to: "/app/lager/wareneingang", label: "Wareneingang", icon: Warehouse },
      { to: "/app/lager/transfers", label: "Transfers", icon: Warehouse },
      { to: "/app/lager/reservierungen", label: "Reservierungen", icon: Warehouse },
      { to: "/app/lager/lagerorte", label: "Lagerorte", icon: Warehouse },
      { to: "/app/versand", label: "Versand", icon: Truck },
      { to: "/app/versand/versandarten", label: "Versandarten", icon: Truck },
      { to: "/app/versand/dienstleister", label: "Dienstleister", icon: Truck },
    ],
  },
  {
    id: "finance",
    label: "Finanzen",
    items: [
      { to: "/app/dokumente", label: "Dokumente", icon: FileText },
      { to: "/app/dokumente/einstellungen", label: "Dokument-Einstellungen", icon: FileText },
      { to: "/app/steuern", label: "Steuern", icon: Receipt },
    ],
  },
  {
    id: "communication",
    label: "Kommunikation",
    items: [
      { to: "/app/kommunikation", label: "Übersicht", icon: Mail },
      { to: "/app/kommunikation/vorlagen", label: "Vorlagen", icon: Mail },
      { to: "/app/kommunikation/verlauf", label: "Verlauf", icon: Mail },
      { to: "/app/kommunikation/branding", label: "Branding Studio", icon: Mail },
      { to: "/app/kommunikation/regeln", label: "Sende-Regeln", icon: Mail },
      { to: "/app/automationen", label: "Automationen", icon: Workflow },
      { to: "/app/automationen/verlauf", label: "Automations-Verlauf", icon: Workflow },
      { to: "/app/automationen/webhooks", label: "Webhooks", icon: Workflow },
      { to: "/app/automationen/aufgaben", label: "Aufgaben", icon: CheckSquare },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { to: "/app/einstellungen/integrationen", label: "Integrationen", icon: Plug },
      { to: "/app/system/health", label: "System Health", icon: Activity },
      { to: "/app/system/jobs", label: "Jobs & Queues", icon: ServerCog },
      { to: "/app/system/status", label: "Systemstatus", icon: Gauge },
      { to: "/app/system/errors", label: "Systemfehler", icon: TriangleAlert },
      { to: "/app/system/demo-daten", label: "Demo & QA", icon: FlaskConical },
      { to: "/app/team", label: "Team", icon: UserCog },
      { to: "/app/shops", label: "Shops", icon: Building2 },
      { to: "/app/audit", label: "Audit-Log", icon: ScrollText },
    ],
  },
  {
    id: "developer",
    label: "Entwickler",
    items: [
      { to: "/app/entwickler", label: "API-Keys", icon: Code2 },
      { to: "/app/entwickler/api", label: "API-Referenz", icon: Code2 },
      { to: "/app/entwickler/protokoll", label: "Request-Protokoll", icon: Code2 },
      { to: "/app/system/storefront-test", label: "Test-Storefront", icon: Store },
      { to: "/store", label: "Referenz-Storefront", icon: Store },
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
  { to: "/app/system/health", label: "System", icon: Activity },
];

export function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
}
