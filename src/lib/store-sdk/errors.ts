import type { StoreErrorCode } from "./types";

export type CommerceErrorInit = {
  code: StoreErrorCode;
  message: string;
  status: number;
  fieldErrors?: Record<string, string>;
  requestId?: string | null;
};

/** The single error shape every SDK call rejects with. */
export class CommerceError extends Error {
  readonly code: StoreErrorCode;
  readonly status: number;
  readonly fieldErrors: Record<string, string> | null;
  readonly requestId: string | null;

  constructor(init: CommerceErrorInit) {
    super(init.message);
    this.name = "CommerceError";
    this.code = init.code;
    this.status = init.status;
    this.fieldErrors = init.fieldErrors ?? null;
    this.requestId = init.requestId ?? null;
  }

  /** Whether a retry can plausibly succeed. Never true for validation/auth. */
  get retryable(): boolean {
    if (this.code === "RATE_LIMITED") return true;
    if (this.code === "INTERNAL_ERROR") return this.status === 0 || this.status >= 500;
    return false;
  }
}

export function networkError(message: string): CommerceError {
  return new CommerceError({ code: "INTERNAL_ERROR", message, status: 0 });
}

export function isCommerceError(error: unknown): error is CommerceError {
  return error instanceof CommerceError;
}
