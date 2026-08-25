/** Admin customer API. Thin wrappers; every call is permission-checked. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  CustomerAddressInput,
  CustomerDetail,
  CustomerListItem,
  CustomerStatus,
} from "./customer.types";

type Org = { organizationId: string };

export const listCustomersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & {
        shopId?: string | null;
        search?: string | null;
        status?: CustomerStatus | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }): Promise<CustomerListItem[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "customers.read");
    const { listCustomers } = await import("./customer.server");
    return await listCustomers(data);
  });

export const getCustomerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { customerId: string }) => data)
  .handler(async ({ data, context }): Promise<CustomerDetail> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "customers.read");
    const { loadCustomer } = await import("./customer.server");
    return await loadCustomer(data.organizationId, data.customerId);
  });

export const saveCustomerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & {
        shopId: string;
        customerId?: string | null;
        email: string;
        firstName?: string | null;
        lastName?: string | null;
        phone?: string | null;
        customerType?: "b2c" | "b2b";
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "customers.manage",
    );
    const { upsertCustomer } = await import("./customer.server");
    return await upsertCustomer({ ...data, actorId: context.userId });
  });

export const setCustomerStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: Org & { customerId: string; status: CustomerStatus; reason?: string | null }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    const permission = data.status === "blocked" ? "customers.block" : "customers.manage";
    await assertPermission(context.supabase, context.userId, data.organizationId, permission);
    const { setCustomerStatus } = await import("./customer.server");
    return await setCustomerStatus({ ...data, actorId: context.userId });
  });

export const saveCustomerAddressFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { customerId: string; address: CustomerAddressInput }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "customers.manage",
    );
    const { saveAddress } = await import("./customer.server");
    return await saveAddress(data);
  });

export const deleteCustomerAddressFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { addressId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "customers.manage",
    );
    const { deleteAddress } = await import("./customer.server");
    return await deleteAddress(data.organizationId, data.addressId);
  });

export const setCustomerGroupsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { customerId: string; groupIds: string[] }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "customer_groups.assign",
    );
    const { setCustomerGroups } = await import("./customer.server");
    return await setCustomerGroups(data);
  });

export const addCustomerNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { customerId: string; body: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "customers.manage",
    );
    const { addCustomerNote } = await import("./customer.server");
    return await addCustomerNote({ ...data, actorId: context.userId });
  });

/** Creates a guest access link for exactly one order. Raw token is shown once. */
export const createGuestAccessLinkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { shopId: string; orderId: string; ttlHours?: number }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "orders.manage");
    const { issueGuestToken } = await import("./customer.server");
    return await issueGuestToken({ ...data, actorId: context.userId });
  });

export const revokeGuestAccessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { orderId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "orders.manage");
    const { revokeGuestTokens } = await import("./customer.server");
    return await revokeGuestTokens(data.organizationId, data.orderId);
  });
