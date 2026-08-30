import type { StatusTone } from "./StatusBadge";

/** Shared status vocabulary → tone mapping (presentation only). */
export function orderTone(status: string): StatusTone {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  if (status === "processing" || status === "confirmed") return "info";
  return "neutral";
}

export function paymentTone(status: string): StatusTone {
  if (status === "paid") return "success";
  if (status === "failed") return "danger";
  if (status === "unpaid") return "warning";
  if (status === "refunded" || status === "partially_refunded") return "neutral";
  return "info";
}

export function fulfillmentTone(status: string): StatusTone {
  if (status === "fulfilled") return "success";
  if (status === "partially_fulfilled") return "warning";
  if (status === "returned") return "info";
  return "neutral";
}
