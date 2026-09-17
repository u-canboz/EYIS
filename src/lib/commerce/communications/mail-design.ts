import {
  BLOCK_LABELS,
  DEFAULT_BRANDING,
  type CommunicationBranding,
  type Block,
} from "./communication.types";

export function normalizeBranding(input: Partial<CommunicationBranding>): CommunicationBranding {
  const b = { ...DEFAULT_BRANDING, ...input };
  for (const key of [
    "primaryColor",
    "backgroundColor",
    "contentBackgroundColor",
    "textColor",
    "mutedTextColor",
  ] as const)
    if (!/^#[\da-f]{6}$/i.test(b[key])) b[key] = DEFAULT_BRANDING[key];
  if (!/^[a-zA-Z0-9 ,'-]{1,120}$/.test(b.fontFamily)) b.fontFamily = DEFAULT_BRANDING.fontFamily;
  b.borderRadius = Math.max(0, Math.min(32, Number(b.borderRadius) || 0));
  return b;
}

export function validateMailBlocks(blocks: Block[], complete = false): void {
  if (!Array.isArray(blocks) || blocks.length > 60)
    throw new Error("Eine E-Mail darf höchstens 60 Blöcke enthalten.");
  for (const block of blocks) {
    if (!block || !Object.prototype.hasOwnProperty.call(BLOCK_LABELS, block.type))
      throw new Error("Unbekannter E-Mail-Baustein.");
    if (
      ["image", "attachment"].includes(block.type) &&
      (complete || block.mediaId) &&
      !/^[a-f0-9-]{36}$/i.test(block.mediaId ?? "")
    )
      throw new Error("Bitte eine Datei für den Bild- oder Anhang-Baustein auswählen.");
    if (complete && block.type === "products" && !block.productIds?.length)
      throw new Error("Bitte Produkte auswählen oder den leeren Produktbaustein entfernen.");
    if ((block.text?.length ?? 0) > 12000) throw new Error("Ein Textblock ist zu lang.");
    if (block.url && !/^(https?:\/\/|mailto:|\{\{(?:links|shop)\.)/i.test(block.url))
      throw new Error("Links müssen mit https:// beginnen.");
    if ((block.productIds?.length ?? 0) > 12)
      throw new Error("Bitte höchstens 12 Produkte pro Block auswählen.");
  }
}
