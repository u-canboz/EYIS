import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../core.server", () => ({
  assertPermission: vi.fn(),
  writeAudit: vi.fn(),
  emitEvent: vi.fn(),
  slugify: vi.fn(),
}));
import { generateProductVariants } from "../variants.server";

type Row = Record<string, unknown>;
let variants: Row[];
let requestedTables: string[];
function database(owner = "org-a") {
  return {
    from(table: string) {
      requestedTables.push(table);
      const filters: Record<string, unknown> = {};
      let insert: Row | Row[] | undefined;
      const response = () => {
        if (table === "products")
          return {
            data: filters["organization_id"] === owner ? { id: "product-a" } : null,
            error: null,
          };
        if (table === "product_options") return { data: [], error: null };
        if (table === "product_variants") {
          if (insert && !Array.isArray(insert)) {
            const row = { id: `v${variants.length}`, ...insert };
            variants.push(row);
            return { data: row, error: null };
          }
          return {
            data: variants.filter((v) => v["organization_id"] === filters["organization_id"]),
            error: null,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      };
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters[key] = value;
          return query;
        },
        order: () => query,
        insert: (row: Row | Row[]) => {
          insert = row;
          return query;
        },
        single: async () => response(),
        maybeSingle: async () => response(),
        then: (resolve: (value: ReturnType<typeof response>) => unknown) =>
          Promise.resolve(response()).then(resolve),
      };
      return query;
    },
  };
}
const run = (input: {
  data: { productId: string; organizationId: string };
  context: { supabase: ReturnType<typeof database>; userId: string };
}) =>
  generateProductVariants(
    input.context.supabase as unknown as Parameters<typeof generateProductVariants>[0],
    input.context.userId,
    input.data,
  );
const input = (owner = "org-a") => ({
  data: { productId: "product-a", organizationId: "org-a" },
  context: { supabase: database(owner), userId: "owner" },
});

beforeEach(() => {
  variants = [];
  requestedTables = [];
  vi.clearAllMocks();
});
describe("standard variant creation", () => {
  it("creates a purchasable standard record for a product without options", async () => {
    expect(await run(input())).toEqual({ created: 1, skipped: 0 });
    expect(variants[0]).toMatchObject({
      title: "Standard",
      organization_id: "org-a",
      product_id: "product-a",
      option_signature: "",
    });
    expect(requestedTables).not.toContain("variant_option_values");
  });
  it("does not duplicate the standard variant when generation is repeated", async () => {
    await run(input());
    expect(await run(input())).toEqual({ created: 0, skipped: 1 });
    expect(variants).toHaveLength(1);
  });
  it("rejects a product owned by a different organization before reading children", async () => {
    await expect(run(input("org-b"))).rejects.toThrow("Produkt nicht gefunden");
    expect(requestedTables).toEqual(["products"]);
    expect(variants).toHaveLength(0);
  });
});
