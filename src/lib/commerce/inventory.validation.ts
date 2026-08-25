/** Input validation for inventory operations. Shared by server functions and UI. */

export function positiveInt(value: unknown, label: string) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${label} muss eine ganze Zahl größer als 0 sein.`);
  return n;
}

export function nonNegativeInt(value: unknown, label: string) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${label} muss eine ganze Zahl ab 0 sein.`);
  return n;
}

export function nonZeroInt(value: unknown, label: string) {
  const n = Number(value);
  if (!Number.isInteger(n) || n === 0) throw new Error(`${label} muss eine ganze Zahl ungleich 0 sein.`);
  return n;
}

export function requiredText(value: unknown, label: string) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) throw new Error(`${label} ist erforderlich.`);
  return s;
}

export function optionalText(value: unknown) {
  const s = typeof value === "string" ? value.trim() : "";
  return s || null;
}

export function requiredId(value: unknown, label: string) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    throw new Error(`${label} ist ungültig.`);
  }
  return s;
}

export function newIdempotencyKey() {
  return crypto.randomUUID();
}
