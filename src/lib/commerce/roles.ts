import type { Role } from "./workspace.functions";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Inhaber",
  administrator: "Administrator",
  operations: "Operations",
  catalog_manager: "Katalog-Manager",
  fulfillment: "Fulfillment",
  customer_support: "Kundenservice",
  finance: "Finanzen",
  marketing: "Marketing",
  developer: "Entwickler",
  read_only: "Nur Lesen",
};

export const ASSIGNABLE_ROLES: Role[] = [
  "administrator",
  "operations",
  "catalog_manager",
  "fulfillment",
  "customer_support",
  "finance",
  "marketing",
  "developer",
  "read_only",
];

export function roleLabel(role: string) {
  return ROLE_LABELS[role as Role] ?? role;
}

export const ACTION_LABELS: Record<string, string> = {
  "organization.created": "Organisation angelegt",
  "shop.updated": "Shop aktualisiert",
  "shop_domain.added": "Domain hinzugefügt",
  "shop_domain.removed": "Domain entfernt",
  "invitation.created": "Einladung erstellt",
  "invitation.revoked": "Einladung widerrufen",
  "invitation.accepted": "Einladung angenommen",
  "membership.role_changed": "Rolle geändert",
  "membership.removed": "Mitglied entfernt",
};
