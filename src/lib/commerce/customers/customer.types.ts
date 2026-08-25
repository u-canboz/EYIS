/** Shared customer types for admin workspace and customer portal. */

export type CustomerStatus = "active" | "blocked" | "guest" | "archived";
export type CustomerKind = "b2c" | "b2b";
export type CustomerAddressType = "shipping" | "billing" | "both";

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: "Aktiv",
  blocked: "Gesperrt",
  guest: "Gast",
  archived: "Archiviert",
};

export const CUSTOMER_KIND_LABELS: Record<CustomerKind, string> = {
  b2c: "Privatkunde",
  b2b: "Geschäftskunde",
};

export type CustomerAddress = {
  id: string;
  customerId: string;
  type: CustomerAddressType;
  firstName: string;
  lastName: string;
  company: string | null;
  street: string;
  street2: string | null;
  postalCode: string;
  city: string;
  state: string | null;
  countryCode: string;
  phone: string | null;
  isDefault: boolean;
};

export type CustomerListItem = {
  id: string;
  shopId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  status: CustomerStatus;
  customerType: CustomerKind;
  hasAccount: boolean;
  createdAt: string;
  orderCount: number;
  totalSpentMinor: number;
  currencyCode: string;
  lastOrderAt: string | null;
};

export type CustomerOrderSummary = {
  id: string;
  orderNumber: string;
  placedAt: string;
  totalMinor: number;
  currencyCode: string;
  orderStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
};

export type CustomerNote = {
  id: string;
  body: string;
  authorId: string | null;
  createdAt: string;
};

export type CustomerDetail = CustomerListItem & {
  addresses: CustomerAddress[];
  groupIds: string[];
  orders: CustomerOrderSummary[];
  notes: CustomerNote[];
  returnCount: number;
};

export type CustomerAddressInput = {
  id?: string | null;
  type: CustomerAddressType;
  firstName: string;
  lastName: string;
  company?: string | null;
  street: string;
  street2?: string | null;
  postalCode: string;
  city: string;
  state?: string | null;
  countryCode: string;
  phone?: string | null;
  isDefault?: boolean;
};
