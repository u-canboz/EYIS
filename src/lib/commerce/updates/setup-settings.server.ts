/**
 * Persistente Update-Einrichtung (server-only).
 *
 * Die vom Einrichtungsassistenten ermittelten Werte gehören zur Installation
 * und nicht in Umgebungsvariablen des Kunden. Sie liegen deshalb im bereits
 * ausgelieferten Singleton `commerce_installation.update_config.setup`.
 *
 * Priorität beim Lesen: Datenbank → Umgebung → Auslieferungs-Defaults.
 * Es werden ausschließlich nicht-geheime Werte gespeichert; Zugangsdaten
 * (GitHub, Datenbank) bleiben im Secret-Store bzw. im GitHub-Gateway.
 */
import { getAdmin } from "../core.server";

export type UpdateSetupSettings = {
  customerRepo?: string;
  hosting?: string;
  healthUrl?: string;
  publishAckAt?: string | null;
  publishAckBy?: string | null;
  dbSecretSyncedAt?: string | null;
  lastSetupAt?: string | null;
  lastSetupReport?: unknown;
};

type Row = Record<string, unknown>;

async function loadInstallationRow(): Promise<{
  admin: Awaited<ReturnType<typeof getAdmin>>;
  updateConfig: Row;
} | null> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("commerce_installation")
    .select("update_config")
    .eq("singleton", true)
    .maybeSingle();
  if (error || !data) return null;
  const updateConfig = ((data as Row)["update_config"] as Row | null) ?? {};
  return { admin, updateConfig };
}

/** Gespeicherte Einrichtung; `null`, wenn noch nichts hinterlegt ist. */
export async function readUpdateSetupSettings(): Promise<UpdateSetupSettings | null> {
  try {
    const loaded = await loadInstallationRow();
    if (!loaded) return null;
    const setup = loaded.updateConfig["setup"] as UpdateSetupSettings | undefined;
    return setup ?? null;
  } catch {
    return null;
  }
}

/** Schreibt Teilwerte der Einrichtung zurück (merge, nie destruktiv). */
export async function writeUpdateSetupSettings(
  patch: UpdateSetupSettings,
): Promise<UpdateSetupSettings> {
  const loaded = await loadInstallationRow();
  if (!loaded) throw new Error("INSTALLATION_NOT_FOUND");
  const current = (loaded.updateConfig["setup"] as UpdateSetupSettings | undefined) ?? {};
  const next: UpdateSetupSettings = { ...current, ...patch };
  const { error } = await loaded.admin
    .from("commerce_installation")
    .update({ update_config: { ...loaded.updateConfig, setup: next } } as never)
    .eq("singleton", true);
  if (error) throw new Error(`SETUP_SAVE_FAILED: ${error.message}`);
  return next;
}
