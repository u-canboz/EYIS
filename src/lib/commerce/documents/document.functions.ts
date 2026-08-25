/** Server functions for the invoicing & document engine. Thin wrappers only. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  DeliveryNoteView,
  DocumentSetup,
  InvoiceListItem,
  InvoiceStatus,
  InvoiceView,
} from "./document.types";

type Org = { organizationId: string };

export const listInvoicesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & { shopId?: string | null; status?: InvoiceStatus | null; search?: string | null },
    ) => data,
  )
  .handler(async ({ data, context }): Promise<InvoiceListItem[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "invoices.read");
    const { listInvoices } = await import("./document.server");
    return await listInvoices(data);
  });

export const getInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { invoiceId: string }) => data)
  .handler(async ({ data, context }): Promise<InvoiceView> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "invoices.read");
    const { loadInvoice } = await import("./document.server");
    return await loadInvoice(data.organizationId, data.invoiceId);
  });

export const getOrderDocumentsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { orderId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "invoices.read");
    const { loadOrderDocuments } = await import("./document.server");
    return await loadOrderDocuments(data.organizationId, data.orderId);
  });

export const listDeliveryNotesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { shopId?: string | null }) => data)
  .handler(async ({ data, context }): Promise<DeliveryNoteView[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "invoices.read");
    const { listDeliveryNotes } = await import("./document.server");
    return await listDeliveryNotes(data.organizationId, data.shopId ?? null);
  });

export const getDocumentSetupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { shopId: string }) => data)
  .handler(async ({ data, context }): Promise<DocumentSetup> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "invoices.read");
    const { loadSetup } = await import("./document.server");
    return await loadSetup(data.organizationId, data.shopId);
  });

export const saveInvoiceSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { shopId: string; values: Record<string, unknown> }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "documents.settings",
    );
    const { saveInvoiceSettings } = await import("./document.server");
    return await saveInvoiceSettings({ ...data, actorId: context.userId });
  });

export const saveBrandingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { shopId: string; values: Record<string, unknown> }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "documents.settings",
    );
    const { saveBranding } = await import("./document.server");
    return await saveBranding({ ...data, actorId: context.userId });
  });

export const saveSequenceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & {
        shopId: string;
        documentType: string;
        prefix: string;
        suffix: string | null;
        padding: number;
        resetPolicy: string;
        includePeriod: boolean;
        nextNumber?: number | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "documents.settings",
    );
    const { saveSequence } = await import("./document.server");
    return await saveSequence({ ...data, actorId: context.userId });
  });

export const createInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { orderId: string; idempotencyKey?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "invoices.manage",
    );
    const { createInvoiceFromOrder } = await import("./document.server");
    return await createInvoiceFromOrder({ ...data, actorId: context.userId });
  });

export const issueInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { invoiceId: string; idempotencyKey?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "invoices.issue");
    const { issueInvoice } = await import("./document.server");
    return await issueInvoice({ ...data, actorId: context.userId });
  });

export const voidInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { invoiceId: string; reason?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "invoices.manage",
    );
    const { voidInvoice } = await import("./document.server");
    return await voidInvoice({ ...data, actorId: context.userId });
  });

export const createCreditNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & {
        invoiceId: string;
        amountMinor: number;
        reason?: string | null;
        refundId?: string | null;
        issueImmediately?: boolean;
        idempotencyKey?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "invoices.credit",
    );
    const { createCreditNote, issueCreditNote } = await import("./document.server");
    const created = await createCreditNote({ ...data, actorId: context.userId });
    if (data.issueImmediately) {
      const issued = await issueCreditNote({
        organizationId: data.organizationId,
        creditNoteId: created.credit_note_id,
        actorId: context.userId,
      });
      return { ...created, ...issued };
    }
    return created;
  });

export const issueCreditNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { creditNoteId: string; idempotencyKey?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "invoices.credit",
    );
    const { issueCreditNote } = await import("./document.server");
    return await issueCreditNote({ ...data, actorId: context.userId });
  });

export const createDeliveryNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & { fulfillmentId: string; notes?: string | null; idempotencyKey?: string | null },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "invoices.manage",
    );
    const { createDeliveryNote } = await import("./document.server");
    return await createDeliveryNote({ ...data, actorId: context.userId });
  });

export const regenerateDocumentPdfFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & { documentType: "invoice" | "credit_note" | "delivery_note"; documentId: string },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "invoices.manage",
    );
    const server = await import("./document.server");
    if (data.documentType === "invoice") {
      return await server.generateInvoicePdf({
        organizationId: data.organizationId,
        invoiceId: data.documentId,
        actorId: context.userId,
        force: true,
      });
    }
    if (data.documentType === "credit_note") {
      return await server.generateCreditNotePdf({
        organizationId: data.organizationId,
        creditNoteId: data.documentId,
        actorId: context.userId,
      });
    }
    return await server.generateDeliveryNotePdf({
      organizationId: data.organizationId,
      deliveryNoteId: data.documentId,
      actorId: context.userId,
    });
  });

export const getDocumentUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { documentId: string }) => data)
  .handler(async ({ data, context }): Promise<{ url: string | null }> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "invoices.read");
    const { signDocumentFile } = await import("./document.server");
    return await signDocumentFile(data.organizationId, data.documentId);
  });
