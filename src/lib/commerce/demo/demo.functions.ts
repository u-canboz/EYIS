import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { QaScenario, SeedStep } from "./demo.types";

function originFromRequest(): string {
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return "http://localhost:8080";
  }
}

export const getDemoStatusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAdmin } = await import("../core.server");
    const { getDemoStatus } = await import("./seed.server");
    const admin = await getAdmin();
    const email = (context.claims as { email?: string } | undefined)?.email ?? null;
    return getDemoStatus({ admin, userId: context.userId, email, origin: originFromRequest() });
  });

export const runDemoSeedStepFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { step: SeedStep }) => data)
  .handler(async ({ data, context }) => {
    const { getAdmin } = await import("../core.server");
    const { runSeedStep } = await import("./seed.server");
    const admin = await getAdmin();
    const email = (context.claims as { email?: string } | undefined)?.email ?? null;
    return runSeedStep(
      { admin, userId: context.userId, email, origin: originFromRequest() },
      data.step,
    );
  });

export const resetDemoEnvironmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAdmin } = await import("../core.server");
    const { resetDemo } = await import("./seed.server");
    const admin = await getAdmin();
    const email = (context.claims as { email?: string } | undefined)?.email ?? null;
    return resetDemo({ admin, userId: context.userId, email, origin: originFromRequest() });
  });

export const listQaFixturesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAdmin } = await import("../core.server");
    const { listQaFixtures } = await import("./fixtures.server");
    const admin = await getAdmin();
    const email = (context.claims as { email?: string } | undefined)?.email ?? null;
    return listQaFixtures({ admin, userId: context.userId, email });
  });

export const createQaFixtureFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { scenario: QaScenario }) => data)
  .handler(async ({ data, context }) => {
    const { getAdmin } = await import("../core.server");
    const { createQaFixture } = await import("./fixtures.server");
    const admin = await getAdmin();
    const email = (context.claims as { email?: string } | undefined)?.email ?? null;
    return createQaFixture({ admin, userId: context.userId, email }, data.scenario);
  });

export const destroyQaFixtureFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fixtureId: string }) => data)
  .handler(async ({ data, context }) => {
    const { getAdmin } = await import("../core.server");
    const { destroyQaFixture } = await import("./fixtures.server");
    const admin = await getAdmin();
    const email = (context.claims as { email?: string } | undefined)?.email ?? null;
    return destroyQaFixture({ admin, userId: context.userId, email }, data.fixtureId);
  });
