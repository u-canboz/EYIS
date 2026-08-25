/** Shared inventory types. One definition of stock truth for server and UI. */

export type LocationType = "warehouse" | "store" | "fulfillment_center" | "virtual";
export type EntityStatus = "active" | "inactive" | "archived";
export type ReservationStatus = "active" | "released" | "committed" | "expired";
export type TransferStatus = "draft" | "in_transit" | "completed" | "cancelled";

export type MovementType =
  | "initial_stock"
  | "receipt"
  | "adjustment"
  | "reservation"
  | "reservation_release"
  | "sale_commit"
  | "return"
  | "transfer_out"
  | "transfer_in"
  | "damage"
  | "correction";

export type InventoryLocation = {
  id: string;
  name: string;
  code: string;
  type: LocationType;
  status: EntityStatus;
  priority: number;
  address: Record<string, unknown>;
};

export type LevelNumbers = {
  on_hand: number;
  reserved: number;
  incoming: number;
  damaged: number;
};

/**
 * The single stock definition used everywhere:
 *   physical_on_hand = on_hand (includes damaged goods)
 *   sellable_on_hand = on_hand - damaged
 *   available        = sellable_on_hand - reserved
 */
export function sellableOnHand(level: LevelNumbers) {
  return level.on_hand - level.damaged;
}

export function availableQuantity(level: LevelNumbers) {
  return level.on_hand - level.damaged - level.reserved;
}

export function sumLevels(levels: LevelNumbers[]): LevelNumbers {
  return levels.reduce<LevelNumbers>(
    (acc, l) => ({
      on_hand: acc.on_hand + l.on_hand,
      reserved: acc.reserved + l.reserved,
      incoming: acc.incoming + l.incoming,
      damaged: acc.damaged + l.damaged,
    }),
    { on_hand: 0, reserved: 0, incoming: 0, damaged: 0 },
  );
}

export type StockStatus = "untracked" | "out_of_stock" | "low_stock" | "in_stock" | "backorder";

export function stockStatus(args: {
  trackInventory: boolean;
  allowBackorder: boolean;
  available: number;
  threshold: number;
}): StockStatus {
  if (!args.trackInventory) return "untracked";
  if (args.available <= 0) return args.allowBackorder ? "backorder" : "out_of_stock";
  if (args.threshold > 0 && args.available <= args.threshold) return "low_stock";
  return "in_stock";
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  untracked: "Nicht verfolgt",
  out_of_stock: "Ausverkauft",
  low_stock: "Niedriger Bestand",
  in_stock: "Auf Lager",
  backorder: "Nachbestellbar",
};

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  initial_stock: "Anfangsbestand",
  receipt: "Wareneingang",
  adjustment: "Korrektur",
  reservation: "Reservierung",
  reservation_release: "Reservierung freigegeben",
  sale_commit: "Verkauf verbucht",
  return: "Retoure",
  transfer_out: "Umlagerung raus",
  transfer_in: "Umlagerung rein",
  damage: "Beschädigt",
  correction: "Nachbuchung",
};

export const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  warehouse: "Lager",
  store: "Filiale",
  fulfillment_center: "Fulfillment-Center",
  virtual: "Virtuell",
};

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  active: "Aktiv",
  released: "Freigegeben",
  committed: "Verbucht",
  expired: "Abgelaufen",
};

export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  draft: "Entwurf",
  in_transit: "Unterwegs",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
};

export const ADJUSTMENT_REASONS = [
  "Inventurdifferenz",
  "Fehlbuchung",
  "Beschädigung",
  "Diebstahl",
  "Sonstiges",
] as const;

export type InventoryRow = {
  inventory_item_id: string;
  variant_id: string;
  variant_title: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  barcode: string | null;
  track_inventory: boolean;
  allow_backorder: boolean;
  totals: LevelNumbers;
  available: number;
  status: StockStatus;
  locations: {
    location_id: string;
    location_name: string;
    level: LevelNumbers;
    available: number;
  }[];
};

export type AvailabilityResult = {
  tracked: boolean;
  allow_backorder: boolean;
  total_on_hand: number;
  total_reserved: number;
  total_damaged: number;
  total_incoming: number;
  total_available: number;
  locations: {
    location_id: string;
    location_name: string;
    on_hand: number;
    reserved: number;
    damaged: number;
    incoming: number;
    available: number;
  }[];
};

export type MovementRow = {
  id: string;
  created_at: string;
  movement_type: MovementType;
  quantity_delta: number;
  reason: string | null;
  note: string | null;
  reference_type: string | null;
  reference_id: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  location_id: string | null;
  location_name: string | null;
  inventory_item_id: string;
  variant_title: string | null;
  product_name: string | null;
  sku: string | null;
};

export type ReserveResult = {
  reservation_id: string;
  tracked: boolean;
  quantity: number;
  available_now: number | null;
  backordered_quantity: number;
  on_hand?: number;
  reserved?: number;
  available?: number;
};
