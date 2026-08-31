/**
 * BB-RC7-02 — Standard-OAuth ohne plattformgenerierte Module.
 *
 * Das Backoffice hing an `@/integrations/lovable/index`. Dieses Modul gehört
 * zur Kategorie `generated`: es wird von der Plattform im Kundenprojekt
 * erzeugt, ist im Auslieferungsumfang nicht enthalten und kann in einer
 * frischen Dedicated-Installation fehlen — der Build brach dann hart ab.
 *
 * EYIS nutzt deshalb ausschließlich die standardisierte Supabase-Auth-API.
 * Kein Stub, keine Attrappe: `signInWithOAuth` ist die dokumentierte
 * Schnittstelle jedes Supabase-Projekts, auch unter Lovable Cloud.
 */

import { supabase } from "@/integrations/supabase/client";

export type EyisOAuthProvider = "google";

export async function signInWithOAuthProvider(
  provider: EyisOAuthProvider,
  redirectTo: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  return { error: error ? new Error(error.message) : null };
}
